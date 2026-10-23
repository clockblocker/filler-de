import type { LibraryIssue } from "@textfresser/library-core";
import { Cause, Effect } from "effect";

/**
 * Logs what pure Library code returned as issues, under the current span:
 * library-core logs nothing itself.
 */
export const logLibraryIssues = (
	issues: readonly LibraryIssue[],
): Effect.Effect<void> =>
	Effect.forEach(
		issues,
		({ error, message, severity }) =>
			(severity === "Error" ? Effect.logError : Effect.logWarning)(
				message,
				Cause.fail(error),
			),
		{ discard: true },
	);
