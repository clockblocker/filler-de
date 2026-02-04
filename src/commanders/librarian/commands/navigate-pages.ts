import { okAsync, ResultAsync } from "neverthrow";
import { z } from "zod";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";
import { getPageSplitPathByIndex } from "../bookkeeper/page-codec";
import type { CommandError } from "../errors";
import type { LibrarianCommandFn, LibrarianCommandInput } from "./types";

/** Schema for reading page navigation metadata */
const PageNavMetadataSchema = z
	.object({
		nextPageIdx: z.number().optional(),
		noteKind: z.string().optional(),
		prevPageIdx: z.number().optional(),
	})
	.passthrough();

type Direction = "prev" | "next";

function navigateToPage(
	input: LibrarianCommandInput,
	direction: Direction,
): ResultAsync<void, CommandError> {
	const { commandContext, librarianState } = input;
	const { vam } = librarianState;
	const { activeFile } = commandContext;

	// Read metadata from current file content
	const metadata = noteMetadataHelper.read(
		activeFile.content,
		PageNavMetadataSchema,
	);
	if (!metadata || metadata.noteKind !== "Page") {
		return okAsync(undefined);
	}

	const targetIdx =
		direction === "prev" ? metadata.prevPageIdx : metadata.nextPageIdx;

	if (targetIdx === undefined) {
		return okAsync(undefined);
	}

	const targetPage = getPageSplitPathByIndex(activeFile.splitPath, targetIdx);
	if (!targetPage) {
		return okAsync(undefined);
	}

	return ResultAsync.fromSafePromise(vam.cd(targetPage)).map(() => undefined);
}

export const goToPrevPageCommand: LibrarianCommandFn = (input) =>
	navigateToPage(input, "prev");

export const goToNextPageCommand: LibrarianCommandFn = (input) =>
	navigateToPage(input, "next");
