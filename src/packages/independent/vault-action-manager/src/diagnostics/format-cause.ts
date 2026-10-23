import { Cause, Predicate } from "effect";

export type FormatOptions = {
	/** Whether to include stack frames; without them the text is one line. */
	readonly stack?: boolean;
};

/** How deep nested causes, and errors inside fields, are followed. */
const MAX_DEPTH = 8;
const MAX_VALUE_LENGTH = 500;
const MAX_FIELDS = 20;

/**
 * Fields that hold a note's text, such as an action's `content`: shown as
 * their length, so a trace copied for sharing carries no note content.
 */
const CONTENT_FIELDS = new Set(["body", "content", "markdown", "text"]);

const contentLength = (value: string) => `<${value.length} chars>`;

/**
 * Renders every failure and defect in `cause` with its name, `_tag`,
 * message, fields and nested causes, then who interrupted it. Unlike
 * `Cause.squash` it keeps every reason, and unlike `JSON.stringify` it never
 * prints an `Error` as `{}`. It never throws: a value it cannot read is
 * shown as unreadable.
 */
export function formatCause(
	cause: Cause.Cause<unknown>,
	options: FormatOptions = {},
): string {
	return guarded(() => causeText(cause, options, 0));
}

/** `formatCause` for any thrown or failed value, a `Cause` included. */
export function describeError(
	error: unknown,
	options: FormatOptions = {},
): string {
	return guarded(() => errorText(error, options, 0));
}

/**
 * A value as one bounded line: strings quoted, errors described, objects as
 * JSON with their errors described, cycles cut and note content left out.
 */
export function formatValue(value: unknown): string {
	return guarded(() => valueText(value, 0));
}

/**
 * A named value, such as a log annotation, as `formatValue` shows it, except
 * that a note's text under a content field shows as its length.
 */
export function formatField(key: string, value: unknown): string {
	return CONTENT_FIELDS.has(key) && Predicate.isString(value)
		? contentLength(value)
		: formatValue(value);
}

function guarded(render: () => string): string {
	try {
		return render();
	} catch {
		return "[unreadable value]";
	}
}

function causeText(
	cause: Cause.Cause<unknown>,
	options: FormatOptions,
	depth: number,
): string {
	if (cause.reasons.length === 0) return "(empty cause)";
	const parts: string[] = [];
	const interrupters: string[] = [];
	for (const reason of cause.reasons) {
		if (Cause.isInterruptReason(reason)) {
			interrupters.push(
				reason.fiberId === undefined
					? "an unknown fiber"
					: `fiber #${reason.fiberId}`,
			);
			continue;
		}
		const raw = Cause.isDieReason(reason) ? reason.defect : reason.error;
		parts.push(
			`${Cause.isDieReason(reason) ? "Defect: " : ""}${renderError(
				prettyError(Cause.fromReasons([reason]), raw),
				options,
				depth,
			)}`,
		);
	}
	if (interrupters.length > 0)
		parts.push(`Interrupted by ${interrupters.join(", ")}`);
	return parts.join(options.stack === false ? "; " : "\n");
}

function errorText(
	error: unknown,
	options: FormatOptions,
	depth: number,
): string {
	if (Cause.isCause(error)) return causeText(error, options, depth);
	return renderError(prettyError(Cause.fail(error), error), options, depth);
}

/**
 * `Cause.prettyErrors` cleans the stack and adds span frames, but follows
 * `cause` without bound and reads every field: on a cycle or a throwing
 * getter it throws, and the raw value is rendered instead.
 */
function prettyError(cause: Cause.Cause<unknown>, raw: unknown): unknown {
	try {
		return Cause.prettyErrors(cause)[0] ?? raw;
	} catch {
		return raw;
	}
}

function valueText(value: unknown, depth: number): string {
	if (value instanceof Error || Cause.isCause(value))
		return depth >= MAX_DEPTH
			? "[…]"
			: errorText(value, { stack: false }, depth + 1);
	if (Predicate.isBigInt(value)) return `${value}n`;
	if (Predicate.isFunction(value)) return `[Function ${value.name}]`;
	if (Predicate.isSymbol(value) || value === undefined) return String(value);
	const seen = new WeakSet<object>();
	// Stops walking a large value early: what is past the budget is cut.
	let budget = MAX_VALUE_LENGTH;
	let text: string;
	try {
		text =
			JSON.stringify(value, function (key, current: unknown) {
				if (budget < 0) return undefined;
				budget -= key.length;
				if (Predicate.isString(current)) {
					const shown = CONTENT_FIELDS.has(key)
						? contentLength(current)
						: current.length > budget
							? `${current.slice(0, Math.max(0, budget))}…`
							: current;
					budget -= shown.length;
					return shown;
				}
				budget -= 4;
				if (budget < 0) return "…";
				const original: unknown =
					key === "" ? value : (this as Record<string, unknown>)[key];
				if (original instanceof Error)
					return valueText(original, depth + 1);
				if (Predicate.isBigInt(current)) return `${current}n`;
				if (current instanceof Map) return Object.fromEntries(current);
				if (current instanceof Set) return [...current];
				if (Predicate.isObject(current)) {
					if (seen.has(current)) return "[Circular]";
					seen.add(current);
				}
				return current;
			}) ?? safeString(value);
	} catch {
		text = safeString(value);
	}
	return text.length > MAX_VALUE_LENGTH
		? `${text.slice(0, MAX_VALUE_LENGTH)}…`
		: text;
}

function safeString(value: unknown): string {
	try {
		return String(value);
	} catch {
		return "[unreadable value]";
	}
}

/** `value[key]`, or `undefined` when reading it throws. */
function read(value: object, key: PropertyKey): unknown {
	try {
		return (value as Record<PropertyKey, unknown>)[key];
	} catch {
		return undefined;
	}
}

const HIDDEN_FIELDS = new Set(["_tag", "cause", "message", "name", "stack"]);

/** `Name [_tag]: message (field=value …)`, its frames, then its cause. */
function renderError(
	error: unknown,
	options: FormatOptions,
	depth: number,
): string {
	if (!Predicate.isObject(error) && !Predicate.isFunction(error))
		return `Error: ${safeString(error)}`;
	const rawName = read(error, "name");
	const name = Predicate.isString(rawName) ? rawName : "Error";
	const rawMessage = read(error, "message");
	const message = Predicate.isString(rawMessage) ? rawMessage : "";
	const tag = read(error, "_tag");
	let header =
		Predicate.isString(tag) && tag !== name ? `${name} [${tag}]` : name;
	if (message) header += `: ${message}`;

	// A plain object failed: its message already is its JSON.
	let keys: string[] = [];
	if (!message.startsWith("{"))
		try {
			keys = Object.keys(error).filter(
				(key) => !HIDDEN_FIELDS.has(key) && !key.startsWith("~"),
			);
		} catch {
			keys = [];
		}
	const fields = keys.slice(0, MAX_FIELDS).map((key) => {
		const value = read(error, key);
		return `${key}=${
			CONTENT_FIELDS.has(key) && Predicate.isString(value)
				? contentLength(value)
				: valueText(value, depth + 1)
		}`;
	});
	if (keys.length > MAX_FIELDS)
		fields.push(`…${keys.length - MAX_FIELDS} more`);
	if (fields.length > 0) header += ` (${fields.join(", ")})`;

	const cause = read(error, "cause");
	const nested =
		cause instanceof Error && depth < MAX_DEPTH
			? renderError(cause, options, depth + 1)
			: undefined;
	if (options.stack === false)
		return nested ? `${header}; caused by ${nested}` : header;

	const stack = read(error, "stack");
	const frames = (Predicate.isString(stack) ? stack : "")
		.split("\n")
		.filter((line) => /^\s+at /.test(line));
	const lines = [header, ...frames];
	if (nested) lines.push(`  caused by: ${nested.replace(/\n/g, "\n  ")}`);
	return lines.join("\n");
}
