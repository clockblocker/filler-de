import { Cause, Predicate } from "effect";

export type FormatOptions = {
	/** Whether to include stack frames; without them the text is one line. */
	readonly stack?: boolean;
};

const MAX_DEPTH = 8;
const MAX_VALUE_LENGTH = 500;

/**
 * Renders every failure and defect in `cause` with its name, `_tag`,
 * message, fields and nested causes, then who interrupted it. Unlike
 * `Cause.squash` it keeps every reason, and unlike `JSON.stringify` it never
 * prints an `Error` as `{}`.
 */
export function formatCause(
	cause: Cause.Cause<unknown>,
	options: FormatOptions = {},
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
		const [error] = Cause.prettyErrors(Cause.fromReasons([reason]));
		if (error)
			parts.push(
				`${Cause.isDieReason(reason) ? "Defect: " : ""}${renderError(error, options, 0)}`,
			);
	}
	if (interrupters.length > 0)
		parts.push(`Interrupted by ${interrupters.join(", ")}`);
	return parts.join(options.stack === false ? "; " : "\n");
}

/** `formatCause` for any thrown or failed value, a `Cause` included. */
export function describeError(
	error: unknown,
	options: FormatOptions = {},
): string {
	if (Cause.isCause(error)) return formatCause(error, options);
	const [pretty] = Cause.prettyErrors(Cause.fail(error));
	return pretty ? renderError(pretty, options, 0) : String(error);
}

/**
 * A value as one bounded line: strings quoted, errors described, objects as
 * JSON with their errors described and cycles cut.
 */
export function formatValue(value: unknown): string {
	if (value instanceof Error || Cause.isCause(value))
		return describeError(value, { stack: false });
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
				budget -=
					key.length +
					(Predicate.isString(current) ? current.length : 4);
				if (budget < 0) return "…";
				const original: unknown =
					key === "" ? value : (this as Record<string, unknown>)[key];
				if (original instanceof Error)
					return describeError(original, { stack: false });
				if (Predicate.isBigInt(current)) return `${current}n`;
				if (current instanceof Map) return Object.fromEntries(current);
				if (current instanceof Set) return [...current];
				if (Predicate.isObject(current)) {
					if (seen.has(current)) return "[Circular]";
					seen.add(current);
				}
				return current;
			}) ?? String(value);
	} catch {
		text = String(value);
	}
	return text.length > MAX_VALUE_LENGTH
		? `${text.slice(0, MAX_VALUE_LENGTH)}…`
		: text;
}

const HIDDEN_FIELDS = new Set(["_tag", "cause", "message", "name", "stack"]);

/** `Name [_tag]: message (field=value …)`, its frames, then its cause. */
function renderError(
	error: Error,
	options: FormatOptions,
	depth: number,
): string {
	const tag = (error as { readonly _tag?: unknown })._tag;
	let header =
		Predicate.isString(tag) && tag !== error.name
			? `${error.name} [${tag}]`
			: error.name;
	if (error.message) header += `: ${error.message}`;
	// A plain object failed: its message already is its JSON.
	const fields = (error.message.startsWith("{") ? [] : Object.keys(error))
		.filter((key) => !HIDDEN_FIELDS.has(key) && !key.startsWith("~"))
		.map(
			(key) =>
				`${key}=${formatValue((error as unknown as Record<string, unknown>)[key])}`,
		);
	if (fields.length > 0) header += ` (${fields.join(", ")})`;

	const nested =
		error.cause instanceof Error && depth < MAX_DEPTH
			? renderError(error.cause, options, depth + 1)
			: undefined;
	if (options.stack === false)
		return nested ? `${header}; caused by ${nested}` : header;

	const frames = (error.stack ?? "")
		.split("\n")
		.filter((line) => /^\s+at /.test(line));
	const lines = [header, ...frames];
	if (nested) lines.push(`  caused by: ${nested.replace(/\n/g, "\n  ")}`);
	return lines.join("\n");
}
