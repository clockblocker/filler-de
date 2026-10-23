import {
	Cause,
	Exit,
	Logger,
	Option,
	Predicate,
	References,
	Tracer,
} from "effect";
import { formatCause, formatField, formatValue } from "./format-cause";

export type TraceStatus = "ok" | "failed" | "interrupted" | "running";

export type RecordedSpan = {
	readonly name: string;
	readonly spanId: string;
	readonly parentId: string | undefined;
	readonly linkIds: readonly string[];
	/** Epoch milliseconds. */
	readonly start: number;
	readonly end: number | undefined;
	readonly status: TraceStatus;
	/** Numbers and booleans as they are; anything else as bounded text. */
	readonly attributes: ReadonlyMap<string, unknown> | undefined;
	/** The failure, formatted when the span ended. */
	readonly cause: string | undefined;
};

export type RecordedLog = {
	/** Epoch milliseconds. */
	readonly at: number;
	readonly level: string;
	/** Rendered when logged, so it shows the values as they were then. */
	readonly text: string;
	readonly spanId: string | undefined;
	/** The cause, formatted when logged. */
	readonly cause: string | undefined;
};

/**
 * The plugin's recent spans and log entries, each kept in a bounded ring:
 * install `tracer` and `logger` on a runtime to record into it.
 */
export type RecentTrace = {
	readonly tracer: Tracer.Tracer;
	readonly logger: Logger.Logger<unknown, void>;
	/** Records a log entry made outside Effect, such as through `console`. */
	readonly recordLog: (level: string, message: readonly unknown[]) => void;
	/** Finished spans and log entries, oldest first; spans still running. */
	readonly snapshot: () => {
		readonly spans: readonly RecordedSpan[];
		readonly logs: readonly RecordedLog[];
		readonly running: readonly RecordedSpan[];
	};
	/** A readable tree of the last `last` spans and log entries, by time. */
	readonly render: (options?: { readonly last?: number }) => string;
};

class Ring<A> {
	private readonly items: A[] = [];
	private next = 0;
	constructor(private readonly capacity: number) {}
	push(item: A): void {
		this.items[this.next] = item;
		this.next = (this.next + 1) % this.capacity;
	}
	toArray(): A[] {
		return [
			...this.items.slice(this.next),
			...this.items.slice(0, this.next),
		];
	}
}

class RingSpan extends Tracer.NativeSpan {
	/** Wall time, as log entries have it; Effect's clock times durations. */
	readonly startedAt = Date.now();
	constructor(
		options: ConstructorParameters<typeof Tracer.NativeSpan>[0],
		private readonly onEnd: (span: RingSpan) => void,
	) {
		super(options);
	}
	override end(endTime: bigint, exit: Exit.Exit<unknown, unknown>): void {
		super.end(endTime, exit);
		this.onEnd(this);
	}
}

const toMillis = (nanos: bigint): number => Number(nanos / 1000n) / 1000;

/** The longest string a span attribute or a log entry's part keeps. */
const MAX_TEXT_LENGTH = 1000;

const capped = (text: string): string =>
	text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}…` : text;

/**
 * Copies a span's attributes as small values, so the ring holds no
 * reference to whatever a span was annotated with.
 */
function attributesOf(
	span: RingSpan,
): ReadonlyMap<string, unknown> | undefined {
	const attributes = span._attributes;
	if (!attributes || attributes.size === 0) return undefined;
	const copy = new Map<string, unknown>();
	for (const [key, value] of attributes)
		copy.set(
			key,
			Predicate.isNumber(value) || Predicate.isBoolean(value)
				? value
				: Predicate.isString(value)
					? capped(value)
					: formatValue(value),
		);
	return copy;
}

/**
 * A failure is formatted once, when recorded, so the ring holds text rather
 * than the errors and whatever they reference. A failure ends every span it
 * passes through, so the text is cached by cause.
 */
const causeTexts = new WeakMap<Cause.Cause<unknown>, string>();

function causeText(cause: Cause.Cause<unknown>): string | undefined {
	if (cause.reasons.length === 0 || Cause.hasInterruptsOnly(cause))
		return undefined;
	let text = causeTexts.get(cause);
	if (text === undefined) {
		text = formatCause(cause);
		causeTexts.set(cause, text);
	}
	return text;
}

function record(span: RingSpan): RecordedSpan {
	const { status } = span;
	const exit = status._tag === "Ended" ? status.exit : undefined;
	return {
		attributes: attributesOf(span),
		cause: exit && Exit.isFailure(exit) ? causeText(exit.cause) : undefined,
		end:
			status._tag === "Ended"
				? span.startedAt + toMillis(status.endTime - status.startTime)
				: undefined,
		linkIds: span.links.map((link) => link.span.spanId),
		name: span.name,
		parentId: Option.getOrUndefined(span.parent)?.spanId,
		spanId: span.spanId,
		start: span.startedAt,
		status: !exit
			? "running"
			: Exit.isSuccess(exit)
				? "ok"
				: Cause.hasInterruptsOnly(exit.cause)
					? "interrupted"
					: "failed",
	};
}

const messageText = (message: readonly unknown[]): string =>
	message
		.map((part) =>
			typeof part === "string" ? capped(part) : formatValue(part),
		)
		.join(" ");

export function makeRecentTrace(
	options: {
		readonly spanCapacity?: number;
		readonly logCapacity?: number;
	} = {},
): RecentTrace {
	const spanCapacity = options.spanCapacity ?? 2000;
	const spans = new Ring<RecordedSpan>(spanCapacity);
	const logs = new Ring<RecordedLog>(options.logCapacity ?? 1000);
	// Bounded too: a span whose fiber is abandoned never ends.
	const running = new Set<RingSpan>();
	const finish = (span: RingSpan) => {
		if (running.delete(span)) spans.push(record(span));
	};

	const tracer = Tracer.make({
		span: (spanOptions) => {
			const span = new RingSpan(spanOptions, finish);
			if (!span.sampled) return span;
			running.add(span);
			if (running.size > spanCapacity)
				for (const oldest of running) {
					running.delete(oldest);
					break;
				}
			return span;
		},
	});

	const logger = Logger.make<unknown, void>(
		({ cause, date, fiber, logLevel, message }) => {
			let text = messageText(
				Array.isArray(message) ? message : [message],
			);
			const annotations = fiber.getRef(References.CurrentLogAnnotations);
			for (const [key, value] of Object.entries(annotations))
				text += ` ${key}=${formatField(key, value)}`;
			for (const [label, start] of fiber.getRef(
				References.CurrentLogSpans,
			))
				text += ` ${label}=${date.getTime() - start}ms`;
			logs.push({
				at: date.getTime(),
				cause: causeText(cause),
				level: logLevel.toUpperCase(),
				spanId: fiber.cache.span?.spanId,
				text,
			});
		},
	);

	const snapshot = () => ({
		logs: logs.toArray(),
		running: [...running].map(record),
		spans: spans.toArray(),
	});

	return {
		logger,
		recordLog: (level, message) =>
			logs.push({
				at: Date.now(),
				cause: undefined,
				level: level.toUpperCase(),
				spanId: undefined,
				text: messageText(message),
			}),
		render: (renderOptions = {}) =>
			renderTrace(snapshot(), renderOptions.last),
		snapshot,
		tracer,
	};
}

// ─── Rendering ───

type Node =
	| {
			readonly kind: "Span";
			readonly at: number;
			readonly span: RecordedSpan;
			readonly children: Node[];
	  }
	| { readonly kind: "Log"; readonly at: number; readonly log: RecordedLog };

function renderTrace(
	{ logs, running, spans }: ReturnType<RecentTrace["snapshot"]>,
	last: number | undefined,
): string {
	const keptSpans = last === undefined ? spans : spans.slice(-last);
	const keptLogs = last === undefined ? logs : logs.slice(-last);
	const nodes = new Map<string, Extract<Node, { kind: "Span" }>>();
	for (const span of [...keptSpans, ...running])
		nodes.set(span.spanId, {
			at: span.start,
			children: [],
			kind: "Span",
			span,
		});

	const roots: Node[] = [];
	const attach = (node: Node, parentId: string | undefined) => {
		const parent = parentId === undefined ? undefined : nodes.get(parentId);
		(parent ? parent.children : roots).push(node);
	};
	for (const node of nodes.values()) attach(node, node.span.parentId);
	for (const log of keptLogs)
		attach({ at: log.at, kind: "Log", log }, log.spanId);

	const lines = [
		`Recent trace: ${keptSpans.length} finished span(s), ${running.length} running, ${keptLogs.length} log entr${keptLogs.length === 1 ? "y" : "ies"}; oldest first, children indented.`,
	];
	for (const root of byTime(roots)) renderNode(root, "", new Set(), lines);
	return lines.join("\n");
}

const byTime = (nodes: readonly Node[]): Node[] =>
	[...nodes].sort((a, b) => a.at - b.at);

function renderNode(
	node: Node,
	indent: string,
	shownCauses: Set<string>,
	lines: string[],
): void {
	const causeLines = (text: string | undefined): string => {
		if (!text) return "";
		if (shownCauses.has(text)) return " (cause shown above)";
		shownCauses.add(text);
		return `\n${text.replace(/^/gm, `${indent}    `)}`;
	};
	if (node.kind === "Log") {
		const { log } = node;
		lines.push(
			`${indent}${clock(log.at)} [${log.level}] ${log.text}${causeLines(log.cause)}`,
		);
		return;
	}
	const { span } = node;
	const duration =
		span.end === undefined
			? `${milliseconds(Date.now() - span.start)} so far`
			: milliseconds(span.end - span.start);
	const attributes = span.attributes
		? [...span.attributes]
				.map(
					([key, value]) =>
						` ${key}=${Predicate.isString(value) ? JSON.stringify(value) : String(value)}`,
				)
				.join("")
		: "";
	const links =
		span.linkIds.length > 0 ? ` links=${span.linkIds.join(",")}` : "";
	lines.push(
		`${indent}${clock(span.start)} ${span.name} ${duration} ${span.status.toUpperCase()}${attributes}${links}${causeLines(span.cause)}`,
	);
	for (const child of byTime(node.children))
		renderNode(child, `${indent}  `, shownCauses, lines);
}

const milliseconds = (value: number) => `${value.toFixed(1)}ms`;

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

/** `HH:MM:SS.mmm` in local time. */
function clock(epochMillis: number): string {
	const date = new Date(Math.floor(epochMillis));
	return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}
