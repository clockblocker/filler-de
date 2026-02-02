import { ResultAsync } from "neverthrow";
import type { SplitPathToMdFile } from "../../types/split-path";
import type { VaultAction } from "../../types/vault-action";
import { VaultActionKind } from "../../types/vault-action";
import type { OpenedFileService } from "./opened-file-service";

/**
 * Selection information from the active editor.
 * All character positions are relative to the full document content.
 */
export type SelectionInfo = {
	/** Selected text */
	text: string;
	/** File containing the selection */
	splitPath: SplitPathToMdFile;
	/** Character positions in document (0-indexed) */
	range: { from: number; to: number };
	/** Full paragraph/block containing the selection (delimited by blank lines) */
	paragraph: string;
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

		const selectionEnd = selectionStart + selection.length;

		// Extract paragraph
		const paragraph = this.extractParagraph(content, selectionStart);

		return {
			text: selection,
			splitPath,
			range: { from: selectionStart, to: selectionEnd },
			paragraph,
		};
	}

	/**
	 * Replace the current selection with new text.
	 * Uses ProcessMdFile action internally (action-based, not direct mutation).
	 * @param newText - Text to replace selection with
	 * @returns ResultAsync indicating success/failure
	 */
	replace(newText: string): ResultAsync<void, string> {
		const info = this.getInfo();
		if (!info) {
			return ResultAsync.fromPromise(
				Promise.reject(new Error("No selection to replace")),
				() => "No selection to replace",
			);
		}

		const { splitPath, range } = info;

		const action: VaultAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath,
				transform: (content: string) => {
					return (
						content.slice(0, range.from) +
						newText +
						content.slice(range.to)
					);
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
