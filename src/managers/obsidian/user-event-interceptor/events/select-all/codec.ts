/**
 * SelectAllCodec - encodes select-all event data into payload.
 */

import type { EditorView } from "@codemirror/view";
import type { SplitPathToMdFile } from "../../../vault-action-manager/types/split-path";
import type { SelectAllPayload } from "./payload";
import { createSelectAllPayload } from "./payload";

export type SelectAllData = {
	content: string;
	view: EditorView;
	splitPath?: SplitPathToMdFile;
};

export const SelectAllCodec = {
	/**
	 * Apply the selection from payload to the editor.
	 */
	applySelection(payload: SelectAllPayload): void {
		if (payload.customSelection) {
			const { from, to } = payload.customSelection;
			// Use dynamic import to avoid circular dependency
			import("@codemirror/state").then(({ EditorSelection }) => {
				payload.view.dispatch({
					selection: EditorSelection.single(from, to),
				});
			});
		}
	},
	/**
	 * Encode select-all data into a payload.
	 */
	encode(data: SelectAllData): SelectAllPayload {
		return createSelectAllPayload(data.content, data.view, data.splitPath);
	},
};
