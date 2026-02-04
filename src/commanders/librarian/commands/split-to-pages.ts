import { ResultAsync } from "neverthrow";
import { splitToPagesAction } from "../bookkeeper/split-to-pages-action";
import type { LibrarianCommandFn } from "./types";

export const splitToPagesCommand: LibrarianCommandFn = (input) => {
	const { librarianState } = input;
	const { vam, librarian } = librarianState;

	return ResultAsync.fromSafePromise(
		splitToPagesAction({
			activeFileService: vam.activeFileService,
			onSectionCreated: (info) => {
				// Notify librarian to create codex (bypasses self-event filtering)
				librarian.triggerSectionHealing(info);
			},
			vam,
		}),
	).map(() => undefined);
};
