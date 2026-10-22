import { Logger, type LogLevel, References } from "effect";
import { formatCause } from "../diagnostics/format-cause";
import type { RecentTrace } from "../diagnostics/recent-trace";

const sink = globalThis.console;

function method(level: LogLevel.LogLevel): "debug" | "error" | "info" | "warn" {
	if (level === "Fatal" || level === "Error") return "error";
	if (level === "Warn") return "warn";
	if (level === "Debug" || level === "Trace") return "debug";
	return "info";
}

/**
 * Hands each log entry's values to the leveled `console` method as they are,
 * so devtools can inspect them, followed by its cause, its annotations, and
 * the span and log spans it ran in.
 *
 * Effect's `consolePrettyBrowser` logs every level with `console.log` in a
 * collapsed group and renders causes with `Cause.pretty`, which drops a
 * tagged error's fields; `formatStructured` turns the values into JSON.
 */
export const vamConsoleLogger = Logger.make<unknown, void>(
	({ cause, date, fiber, logLevel, message }) => {
		const args: unknown[] = Array.isArray(message)
			? [...message]
			: [message];
		if (cause.reasons.length > 0) args.push(`\n${formatCause(cause)}`);
		const context: Record<string, unknown> = {
			...fiber.getRef(References.CurrentLogAnnotations),
		};
		const span = fiber.cache.span;
		if (span?._tag === "Span") context.span = span.name;
		for (const [label, start] of fiber.getRef(References.CurrentLogSpans))
			context[label] = `${date.getTime() - start}ms`;
		if (Object.keys(context).length > 0) args.push(context);
		sink[method(logLevel)](...args);
	},
);

/** VAM's loggers: the console, and `trace` when the plugin keeps one. */
export function makeVamLoggerLive(trace?: RecentTrace) {
	return Logger.layer(
		trace ? [vamConsoleLogger, trace.logger] : [vamConsoleLogger],
	);
}
