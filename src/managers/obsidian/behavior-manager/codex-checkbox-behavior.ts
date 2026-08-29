/**
 * Thin handler for task checkbox clicks inside codex files.
 * Delegates to Librarian for all logic.
 */

import type {
	UserEventHandler,
	UserEventKind,
} from "@textfresser/obsidian-event-layer";
import { makeSplitPath } from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import type { Librarian } from "../../../commanders/librarian/librarian";

/**
 * Create a handler for task checkbox clicks in codex files.
 * Thin routing layer - delegates to librarian methods.
 */
export function createCodexCheckboxHandler(
	librarian: Librarian,
): UserEventHandler<typeof UserEventKind.CheckboxClicked> {
	return {
		doesApply: (payload) =>
			payload.sourcePath !== undefined &&
			librarian.isCodexInsideLibrary(
				makeSplitPath(payload.sourcePath) as {
					basename: string;
					extension: "md";
					kind: "MdFile";
					pathParts: string[];
				},
			),
		handle: async (payload) => {
			await Effect.runPromise(
				librarian.handleCodexCheckboxClick(payload),
			);
			return { outcome: "handled" } as const;
		},
	};
}
