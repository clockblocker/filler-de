import { okAsync, ResultAsync } from "neverthrow";
import type { CommandError } from "../errors";
import type { LibrarianCommandFn, LibrarianCommandInput } from "./types";

type Direction = "prev" | "next";

function navigateToPage(
	input: LibrarianCommandInput,
	direction: Direction,
): ResultAsync<void, CommandError> {
	const { commandContext, librarianState } = input;
	const { librarian, vam } = librarianState;
	const { activeFile } = commandContext;

	const targetPage =
		direction === "prev"
			? librarian.getPrevPage(activeFile.splitPath)
			: librarian.getNextPage(activeFile.splitPath);
	if (!targetPage) {
		return okAsync(undefined);
	}

	return ResultAsync.fromSafePromise(vam.cd(targetPage)).map(() => undefined);
}

export const goToPrevPageCommand: LibrarianCommandFn = (input) =>
	navigateToPage(input, "prev");

export const goToNextPageCommand: LibrarianCommandFn = (input) =>
	navigateToPage(input, "next");
