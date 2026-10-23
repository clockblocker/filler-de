import {
	type RecentTrace,
	vamConsoleLogger,
} from "@textfresser/vault-action-manager/diagnostics";
import {
	Context,
	Effect,
	Layer,
	Logger,
	type LogLevel,
	References,
	Tracer,
} from "effect";

/** The least severe level the plugin logs. */
const MINIMUM_LOG_LEVEL: LogLevel.LogLevel = "Info";

/** Each log entry goes to the console and into `trace`. */
const loggersOf = (trace: RecentTrace) =>
	new Set([vamConsoleLogger, trace.logger]);

/**
 * Where the plugin's spans and logs go: spans into `trace`, the ring "Copy
 * recent trace" copies, and each log entry to the console and into the same
 * ring, under the span it was logged in.
 */
export function ObservabilityLive(trace: RecentTrace): Layer.Layer<never> {
	return Layer.mergeAll(
		Layer.succeed(Tracer.Tracer, trace.tracer),
		Logger.layer([...loggersOf(trace)]),
		Layer.succeed(References.MinimumLogLevel, MINIMUM_LOG_LEVEL),
	);
}

/** The level of a log made outside Effect; see `makeEdgeLog`. */
export type EdgeLogLevel = Extract<
	LogLevel.Severity,
	"Error" | "Warn" | "Info"
>;

export type EdgeLog = (
	level: EdgeLogLevel,
	message: string,
	...rest: readonly unknown[]
) => void;

/**
 * Logs from plain TypeScript where no Effect runs: a DOM or workspace
 * callback, the runtime's own build failure, and unloading once the runtime
 * is gone. It logs through the same loggers and level as
 * `ObservabilityLive`, so the entry reads as every other does, in the
 * console and in `trace`, but under no span, as there is none. It never
 * needs the plugin runtime, so it logs before the runtime is built and
 * after it is disposed. It never throws. Code that runs in an Effect logs
 * with `Effect.log*` instead, under its span.
 */
export function makeEdgeLog(trace: RecentTrace): EdgeLog {
	const context = Context.make(Logger.CurrentLoggers, loggersOf(trace)).pipe(
		Context.add(References.MinimumLogLevel, MINIMUM_LOG_LEVEL),
	);
	// An Exit, not a throw: a log must not break the callback it is made in.
	const run = Effect.runSyncExitWith(context);
	return (level, message, ...rest) => {
		run(Effect.logWithLevel(level)(message, ...rest));
	};
}
