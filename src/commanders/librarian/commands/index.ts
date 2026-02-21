import { goToNextPageCommand, goToPrevPageCommand } from "./navigate-pages";
import { splitInBlocksCommand } from "./split-in-blocks";
import { splitToPagesCommand } from "./split-to-pages";
import { type LibrarianCommandFn, LibrarianCommandKind } from "./types";

export const commandFnForCommandKind = {
	[LibrarianCommandKind.GoToNextPage]: goToNextPageCommand,
	[LibrarianCommandKind.GoToPrevPage]: goToPrevPageCommand,
	[LibrarianCommandKind.SplitInBlocks]: splitInBlocksCommand,
	[LibrarianCommandKind.SplitToPages]: splitToPagesCommand,
} satisfies Record<LibrarianCommandKind, LibrarianCommandFn>;
