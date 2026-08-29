import { Effect } from "effect";
import type { CommandError } from "../errors";
import type { LibrarianCommandFn, LibrarianCommandInput } from "./types";
import { vamFailureToCommandError } from "./vam-failure";

type Direction = "prev" | "next";

function navigateToPage(
	input: LibrarianCommandInput,
	direction: Direction,
): Effect.Effect<void, CommandError> {
	return Effect.fn("Librarian.navigateToPage")(function* () {
		const { commandContext, librarianState } = input;
		const { librarian, vam } = librarianState;
		const { activeFile } = commandContext;

		const targetPage =
			direction === "prev"
				? librarian.getPrevPage(activeFile.splitPath)
				: librarian.getNextPage(activeFile.splitPath);
		if (!targetPage) return;

		yield* vam
			.cd(targetPage)
			.pipe(Effect.mapError((error) => vamFailureToCommandError(error)));
	})();
}

export const goToPrevPageCommand: LibrarianCommandFn = (input) =>
	navigateToPage(input, "prev");

export const goToNextPageCommand: LibrarianCommandFn = (input) =>
	navigateToPage(input, "next");
