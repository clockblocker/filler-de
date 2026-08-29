import { Effect } from "effect";
import type { SplitPathToMdFile } from "../../types/split-path";
import type {
	ActiveEditorSnapshot,
	SourceActiveEditorSnapshot,
} from "./active-editor-snapshot";
import { annotateFileAccessFailure } from "./tracing";
import type { ActiveFileReader } from "./writer/reader/active-file-reader";

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
	constructor(private readonly reader: ActiveFileReader) {}

	/**
	 * Get current selection info from the active editor.
	 * Sync operation - just reads editor state.
	 * @returns SelectionInfo or null if no active editor
	 */
	getInfo(snapshot?: ActiveEditorSnapshot) {
		const self = this;
		return Effect.fn("vam.activeEditor.read.selection")(
			function* () {
				yield* Effect.annotateCurrentSpan({
					operation: "read-selection",
				});
				const current = yield* self.reader.sourceSnapshot(snapshot);
				yield* Effect.annotateCurrentSpan({ path: current.path });
				return self.fromSnapshot(current);
			},
			Effect.catchTag("VamNoActiveEditorError", () =>
				Effect.succeed(null),
			),
			Effect.tapError(annotateFileAccessFailure),
		)();
	}

	fromSnapshot(current: SourceActiveEditorSnapshot): SelectionInfo {
		const {
			content,
			cursorOffset: position,
			selection,
			selectionStartOffset: selectionStart,
		} = current;
		const surroundingRawBlock = this.extractLine(content, position);
		let selectionStartInBlock: number | null = null;
		if (selection && selectionStart !== null) {
			let lineStart = content.lastIndexOf("\n", position);
			lineStart = lineStart === -1 ? 0 : lineStart + 1;
			selectionStartInBlock = selectionStart - lineStart;
		}

		return {
			selectionStartInBlock,
			splitPathToFileWithSelection: current.splitPath,
			surroundingRawBlock,
			text: selection,
		} satisfies SelectionInfo;
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
