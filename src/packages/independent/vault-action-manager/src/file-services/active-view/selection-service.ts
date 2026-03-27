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
	getInfo(): SelectionInfo | null {
		// Get active md file path
		const splitPath = this.activeFileService.mdPwd();
		if (!splitPath) return null;

		// Get full content for position calculation
		const contentResult = this.activeFileService.getContent();
		if (contentResult.isErr()) return null;
		const content = contentResult.value;

		// Get selection text (may be null if just caret)
		const selection = this.activeFileService.getSelection();

		// Always use cursor offset for position — indexOf(selection) is
		// wrong when the same text appears multiple times in the file.
		const offset = this.activeFileService.getCursorOffset();
		if (offset === null) return null;
		const position = offset;

		// Extract surrounding block
		const surroundingRawBlock = this.extractLine(content, position);

		// Compute selection start offset within the block
		let selectionStartInBlock: number | null = null;
		if (selection) {
			const selStartOffset =
				this.activeFileService.getSelectionStartOffset();
			if (selStartOffset !== null) {
				// Line start in the document
				let lineStart = content.lastIndexOf("\n", position);
				lineStart = lineStart === -1 ? 0 : lineStart + 1;
				selectionStartInBlock = selStartOffset - lineStart;
			}
		}

		return {
			selectionStartInBlock,
			splitPathToFileWithSelection: splitPath,
			surroundingRawBlock,
			text: selection,
		};
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
