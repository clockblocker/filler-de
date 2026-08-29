import { Effect } from "effect";
import type { SplitPathToMdFile } from "../../types/split-path";
import type { ActiveFileService } from "./active-file-service";

/**
 * Selection information from the active editor.
 */
export type SelectionInfo = {
	/** Selected text, null when no selection (caret only) */
	text: string | null;
	/** File containing the selection or caret */
	splitPathToFileWithSelection: SplitPathToMdFile;
	/** Line containing the selection/caret (delimited by newlines), raw text without processing */
	surroundingRawBlock: string;
	/** Character offset of the selection start within `surroundingRawBlock`. Null when no selection. */
	selectionStartInBlock: number | null;
};

/**
 * Service for reading editor selections.
 * Provides a VAM-level abstraction over direct editor access.
 */
export class SelectionService {
	constructor(private readonly activeFileService: ActiveFileService) {}

	/**
	 * Get current selection info from the active editor.
	 * Sync operation - just reads editor state.
	 * @returns SelectionInfo or null if no active editor
	 */
	getInfo() {
		return Effect.gen({ self: this }, function* () {
			const splitPath = yield* this.activeFileService.mdPwd();
			if (!splitPath) return null;
			const content = yield* this.activeFileService.getContent();
			const selection = yield* this.activeFileService.getSelection();
			const position = yield* this.activeFileService.getCursorOffset();
			if (position === null) return null;

			const surroundingRawBlock = this.extractLine(content, position);
			let selectionStartInBlock: number | null = null;
			if (selection) {
				const selectionStart =
					yield* this.activeFileService.getSelectionStartOffset();
				if (selectionStart !== null) {
					let lineStart = content.lastIndexOf("\n", position);
					lineStart = lineStart === -1 ? 0 : lineStart + 1;
					selectionStartInBlock = selectionStart - lineStart;
				}
			}

			return {
				selectionStartInBlock,
				splitPathToFileWithSelection: splitPath,
				surroundingRawBlock,
				text: selection,
			} satisfies SelectionInfo;
		}).pipe(Effect.orElseSucceed(() => null));
	}

	/**
	 * Extract the line containing a given position.
	 * Line boundaries are newlines (\n) or document edges.
	 */
	private extractLine(content: string, position: number): string {
		return extractLine(content, position);
	}
}

/**
 * Extract the line containing a given position.
 * Line boundaries are newlines (\n) or document edges.
 *
 * This is a pure function - no editor/DOM dependencies.
 */
export function extractLine(content: string, position: number): string {
	// Find start: scan backward to newline or doc start
	let start = content.lastIndexOf("\n", position);
	start = start === -1 ? 0 : start + 1; // +1 to skip the \n

	// Find end: scan forward to newline or doc end
	let end = content.indexOf("\n", position);
	end = end === -1 ? content.length : end;

	return content.slice(start, end);
}
