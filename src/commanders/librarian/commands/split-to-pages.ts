import { Effect } from "effect";
import { type CommandError, CommandErrorKind } from "../errors";
import {
	type SplitToPagesError,
	splitToPagesAction,
} from "../pages/split-to-pages-action";
import type { LibrarianCommandFn } from "./types";

function splitToPagesFailureToCommandError(
	error: SplitToPagesError,
): CommandError {
	return {
		kind: CommandErrorKind.DispatchFailed,
		reason: error.reason,
		...("execution" in error ? { execution: error.execution } : {}),
		...("operationId" in error ? { operationId: error.operationId } : {}),
		...("phase" in error ? { phase: error.phase } : {}),
		...("reconciliationId" in error
			? { reconciliationId: error.reconciliationId }
			: {}),
		...("recovery" in error ? { recovery: error.recovery } : {}),
		...("status" in error ? { status: error.status } : {}),
	};
}

export const splitToPagesCommand: LibrarianCommandFn = Effect.fn(
	"Librarian.splitToPagesCommand",
)(function* (input): Effect.fn.Return<void, CommandError> {
	const { librarianState } = input;
	const { vam, librarian } = librarianState;

	yield* splitToPagesAction({
		librarian,
		vam,
	}).pipe(Effect.mapError(splitToPagesFailureToCommandError));
});
