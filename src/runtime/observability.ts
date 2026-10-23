import {
	type RecentTrace,
	vamConsoleLogger,
} from "@textfresser/vault-action-manager/diagnostics";
import { Layer, Logger, References, Tracer } from "effect";

/**
 * Where the plugin's spans and logs go: spans into `trace`, the ring "Copy
 * recent trace" copies, and each log entry to the console and into the same
 * ring, under the span it was logged in.
 */
export function ObservabilityLive(trace: RecentTrace): Layer.Layer<never> {
	return Layer.mergeAll(
		Layer.succeed(Tracer.Tracer, trace.tracer),
		Logger.layer([vamConsoleLogger, trace.logger]),
		Layer.succeed(References.MinimumLogLevel, "Info"),
	);
}
