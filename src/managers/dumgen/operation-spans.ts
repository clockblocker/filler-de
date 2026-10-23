/**
 * Each dumgen operation's `OperationTrace` as attributes on its
 * `dumgen.operation` span, so "Copy recent trace" shows what every
 * operation asked and how it came out: its request counts, its latency
 * and its outcome. It keeps no prompt or answer text (`TracePayloads`
 * stays off).
 *
 * dumgen hands an operation's trace to its `TraceSink` once the
 * operation's span has ended, in the operation's fiber. The tracer
 * `traced` installs therefore holds the end of each `dumgen.operation`
 * span whose fiber's sink is `sink`, and `sink` ends the fiber's latest
 * held span with the trace's attributes. A span dumgen runs under another
 * sink ends as it would.
 */
import { type OperationTrace, TraceSink } from "dumgen";
import { Effect, type Exit, Fiber, Tracer } from "effect";

const OPERATION_SPAN = "dumgen.operation";

type Held = {
	readonly span: Tracer.Span;
	readonly endTime: bigint;
	readonly exit: Exit.Exit<unknown, unknown>;
};

/** A span whose `end` is handed to `hold` instead of ending it. */
class HeldSpan implements Tracer.Span {
	readonly _tag = "Span";
	constructor(
		private readonly inner: Tracer.Span,
		private readonly hold: (held: Held) => void,
	) {}
	get name() {
		return this.inner.name;
	}
	get spanId() {
		return this.inner.spanId;
	}
	get traceId() {
		return this.inner.traceId;
	}
	get parent() {
		return this.inner.parent;
	}
	get annotations() {
		return this.inner.annotations;
	}
	get status() {
		return this.inner.status;
	}
	get attributes() {
		return this.inner.attributes;
	}
	get links() {
		return this.inner.links;
	}
	get sampled() {
		return this.inner.sampled;
	}
	get kind() {
		return this.inner.kind;
	}
	end(endTime: bigint, exit: Exit.Exit<unknown, unknown>): void {
		this.hold({ endTime, exit, span: this.inner });
	}
	attribute(key: string, value: unknown): void {
		this.inner.attribute(key, value);
	}
	event(
		name: string,
		startTime: bigint,
		attributes?: Record<string, unknown>,
	): void {
		this.inner.event(name, startTime, attributes);
	}
	addLinks(links: ReadonlyArray<Tracer.SpanLink>): void {
		this.inner.addLinks(links);
	}
}

const sum = (values: readonly number[]) =>
	values.reduce((total, value) => total + value, 0);

const tenths = (milliseconds: number) => Math.round(milliseconds * 10) / 10;

/** What a `dumgen.operation` span carries of its trace. */
function operationAttributes(
	trace: OperationTrace,
): Readonly<Record<string, number | string>> {
	const { calls, events, resolution, sentences, waits } = trace;
	const failedSentences = sentences.filter(
		({ outcome }) => outcome === "Failed",
	).length;
	return {
		"dumgen.durationMs": tenths(trace.durationMs),
		"dumgen.inputTokens": sum(calls.map(({ inputTokens }) => inputTokens)),
		"dumgen.outputTokens": sum(
			calls.map(({ outputTokens }) => outputTokens),
		),
		"dumgen.requests": calls.length,
		"dumgen.requests.failed": calls.filter(({ failure }) => failure).length,
		"dumgen.requests.jev": calls.filter(
			({ executor }) => executor === "jev",
		).length,
		"dumgen.requests.luna": calls.filter(
			({ executor }) => executor === "luna",
		).length,
		...(waits.length === 0
			? {}
			: {
					"dumgen.waitMs": tenths(
						sum(waits.map(({ waitMs }) => waitMs)),
					),
					"dumgen.waits": waits.length,
				}),
		...(sentences.length === 0
			? {}
			: {
					"dumgen.sentences": sentences.length,
					"dumgen.sentences.failed": failedSentences,
				}),
		...(resolution === undefined
			? {}
			: {
					"dumgen.outcome": resolution.outcome,
					...(resolution.reason === undefined
						? {}
						: { "dumgen.outcome.reason": resolution.reason }),
				}),
		...(events === undefined || events.length === 0
			? {}
			: { "dumgen.events": events.map(({ name }) => name).join(", ") }),
	};
}

/**
 * A `TraceSink` that puts each trace on its operation's span, and
 * `traced`, which runs a program under the tracer that holds those spans
 * for it: the current tracer, wrapped.
 */
export function makeOperationSpans(): {
	readonly sink: (trace: OperationTrace) => void;
	readonly traced: <A, E, R>(
		effect: Effect.Effect<A, E, R>,
	) => Effect.Effect<A, E, R>;
} {
	const held = new WeakMap<Fiber.Fiber<unknown, unknown>, Held[]>();
	const sink = (trace: OperationTrace) => {
		const fiber = Fiber.getCurrent();
		const ended = fiber === undefined ? undefined : held.get(fiber)?.pop();
		if (ended === undefined) return;
		for (const [key, value] of Object.entries(operationAttributes(trace)))
			ended.span.attribute(key, value);
		ended.span.end(ended.endTime, ended.exit);
	};

	const wrappers = new WeakMap<Tracer.Tracer, Tracer.Tracer>();
	const ours = new WeakSet<Tracer.Tracer>();
	const wrap = (inner: Tracer.Tracer): Tracer.Tracer => {
		if (ours.has(inner)) return inner;
		const known = wrappers.get(inner);
		if (known) return known;
		const tracer = Tracer.make({
			span: (options) => {
				const span = inner.span(options);
				if (options.name !== OPERATION_SPAN) return span;
				const fiber = Fiber.getCurrent();
				if (fiber === undefined || fiber.getRef(TraceSink) !== sink)
					return span;
				return new HeldSpan(span, (ended) => {
					const spans = held.get(fiber);
					if (spans) spans.push(ended);
					else held.set(fiber, [ended]);
				});
			},
			...(inner.context === undefined ? {} : { context: inner.context }),
		});
		wrappers.set(inner, tracer);
		ours.add(tracer);
		return tracer;
	};

	return {
		sink,
		traced: (effect) =>
			Effect.flatMap(Effect.tracer, (inner) =>
				Effect.withTracer(effect, wrap(inner)),
			),
	};
}
