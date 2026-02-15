/**
 * SelectAllCodec - encodes select-all event data into payload.
 */

import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { SplitPathToMdFile } from "../../../vault-action-manager/types/split-path";
import { createEventCodec } from "../codec-factory";
import type { SelectAllPayload } from "./payload";
import { createSelectAllPayload } from "./payload";

export type SelectAllData = {
	content: string;
	view: EditorView;
	splitPath?: SplitPathToMdFile;
};

export const SelectAllCodec = createEventCodec(
	/**
	 * Encode select-all data into a payload.
	 */
	(data: SelectAllData): SelectAllPayload =>
		createSelectAllPayload(data.content, data.view, data.splitPath),
	{
		/**
		 * Apply the selection from payload to the editor.
		 */
		applySelection(payload: SelectAllPayload): void {
			if (payload.customSelection) {
				const { from, to } = payload.customSelection;
				payload.view.dispatch({
					selection: EditorSelection.single(from, to),
				});
			}
		},
	},
);
