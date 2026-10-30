import { goToNextPageCommand, goToPrevPageCommand } from "./navigate-pages";
import { splitInSentenceBlocksCommand } from "./split-in-sentence-blocks";
import { splitToPagesCommand } from "./split-to-pages";
import { type LibrarianCommandFn, LibrarianCommandKind } from "./types";

export const commandFnForCommandKind = {
	[LibrarianCommandKind.GoToNextPage]: goToNextPageCommand,
	[LibrarianCommandKind.GoToPrevPage]: goToPrevPageCommand,
	[LibrarianCommandKind.SplitInBlocks]: splitInSentenceBlocksCommand,
	[LibrarianCommandKind.SplitToPages]: splitToPagesCommand,
} satisfies Record<LibrarianCommandKind, LibrarianCommandFn>;
