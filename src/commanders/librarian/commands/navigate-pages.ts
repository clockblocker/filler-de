import { Effect } from "effect";
import { type CommandError, CommandErrorKind } from "../errors";
import type { LibrarianCommandFn, LibrarianCommandInput } from "./types";

type Direction = "prev" | "next";

const navigateToPage = Effect.fn("Librarian.navigateToPage")(function* (
	input: LibrarianCommandInput,
	direction: Direction,
): Effect.fn.Return<void, CommandError> {
	const { commandContext, librarianState } = input;
	const { librarian, vam } = librarianState;
	const { activeFile } = commandContext;

	const targetPage =
		direction === "prev"
			? librarian.getPrevPage(activeFile.splitPath)
			: librarian.getNextPage(activeFile.splitPath);
	if (!targetPage) return;

	yield* vam.cd(targetPage).pipe(
		Effect.mapError(
			(error): CommandError => ({
				kind: CommandErrorKind.DispatchFailed,
				reason: error.message,
			}),
		),
	);
});

export const goToPrevPageCommand: LibrarianCommandFn = (input) =>
	navigateToPage(input, "prev");

export const goToNextPageCommand: LibrarianCommandFn = (input) =>
	navigateToPage(input, "next");
