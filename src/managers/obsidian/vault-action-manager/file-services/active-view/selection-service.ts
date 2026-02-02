import { ResultAsync } from "neverthrow";
import type { SplitPathToMdFile } from "../../types/split-path";
import type { VaultAction } from "../../types/vault-action";
import { VaultActionKind } from "../../types/vault-action";
import type { OpenedFileService } from "./opened-file-service";

/**
 * Selection information from the active editor.
 */
export type SelectionInfo = {
	/** Selected text */
	text: string;
	/** File containing the selection */
	splitPathToFileWithSelection: SplitPathToMdFile;
	/** Full paragraph/block containing the selection (delimited by blank lines) */
	surroundingBlock: string;
};

/**
 * Service for reading and modifying editor selections.
 * Provides a VAM-level abstraction over direct editor access.
 */
export class SelectionService {
	constructor(
		private readonly openedFileService: OpenedFileService,
		private readonly dispatch: (
			actions: readonly VaultAction[],
		) => Promise<unknown>,
	) {}

	/**
	 * Get current selection info from the active editor.
	 * Sync operation - just reads editor state.
	 * @returns SelectionInfo or null if no editor/selection
	 */
	getInfo(): SelectionInfo | null {
		// Get active md file path
		const splitPath = this.openedFileService.mdPwd();
		if (!splitPath) return null;

		// Get selection text
		const selection = this.openedFileService.getSelection();
		if (!selection) return null;

		// Get full content for position calculation
		const contentResult = this.openedFileService.getContent();
		if (contentResult.isErr()) return null;

		const content = contentResult.value;

		// Find selection position in content
		const selectionStart = content.indexOf(selection);
		if (selectionStart === -1) return null;

		// Extract surrounding block
		const surroundingBlock = this.extractParagraph(content, selectionStart);

		return {
			splitPathToFileWithSelection: splitPath,
			surroundingBlock,
			text: selection,
		};
	}

	/**
	 * Replace the current selection with new text.
	 * Uses ProcessMdFile action internally (action-based, not direct mutation).
	 * @param newText - Text to replace selection with
	 * @returns ResultAsync indicating success/failure
	 */
	replace(newText: string): ResultAsync<void, string> {
		// Get current active file path
		const splitPath = this.openedFileService.mdPwd();
		if (!splitPath) {
			return ResultAsync.fromPromise(
				Promise.reject(new Error("No active file")),
				() => "No active file",
			);
		}

		// Get selection text
		const selection = this.openedFileService.getSelection();
		if (!selection) {
			return ResultAsync.fromPromise(
				Promise.reject(new Error("No selection to replace")),
				() => "No selection to replace",
			);
		}

		const action: VaultAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath,
				transform: (content: string) => {
					// Compute range inside transform to get fresh position
					const from = content.indexOf(selection);
					if (from === -1) return content; // selection not found
					const to = from + selection.length;
					return content.slice(0, from) + newText + content.slice(to);
				},
			},
		};

		return ResultAsync.fromPromise(
			this.dispatch([action]).then(() => undefined),
			(e) => (e instanceof Error ? e.message : String(e)),
		);
	}

	/**
	 * Extract the paragraph containing a given position.
	 * Paragraph boundaries are blank lines (\n\n) or document edges.
	 * Includes trailing block IDs if present.
	 */
	private extractParagraph(content: string, position: number): string {
		// Find start: scan backward to blank line or doc start
		let start = content.lastIndexOf("\n\n", position);
		start = start === -1 ? 0 : start + 2; // +2 to skip the \n\n

		// Find end: scan forward to blank line or doc end
		let end = content.indexOf("\n\n", position);
		end = end === -1 ? content.length : end;

		return content.slice(start, end);
	}
}
