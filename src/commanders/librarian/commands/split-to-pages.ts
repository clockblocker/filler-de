import { Effect, Predicate } from "effect";
import { getErrorMessage } from "../../../utils/get-error-message";
import { type CommandError, CommandErrorKind } from "../errors";
import { splitToPagesAction } from "../pages/split-to-pages-action";
import type { LibrarianCommandFn } from "./types";

function splitToPagesFailureToCommandError(error: unknown): CommandError {
	const reason =
		Predicate.hasProperty(error, "reason") &&
		Predicate.isString(error.reason)
			? error.reason
			: getErrorMessage(error);
	return { kind: CommandErrorKind.DispatchFailed, reason };
}

export const splitToPagesCommand: LibrarianCommandFn = Effect.fn(
	"Librarian.splitToPagesCommand",
)(function* (input): Effect.fn.Return<void, CommandError> {
	const { librarianState } = input;
	const { vam, librarian } = librarianState;

	yield* splitToPagesAction({
		onSectionCreated: (info) => {
			// Notify librarian to create codex (bypasses self-event filtering)
			return librarian.triggerSectionHealing(info);
		},
		vam,
	}).pipe(Effect.mapError(splitToPagesFailureToCommandError));
});
