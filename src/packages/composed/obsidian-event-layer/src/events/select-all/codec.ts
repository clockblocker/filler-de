import type { EditorView } from "@codemirror/view";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import type { UserEffectFor } from "../../contracts";
import { createEventCodec } from "../codec-factory";
import type { InternalSelectAllPayload } from "./payload";
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
	(data: SelectAllData): InternalSelectAllPayload =>
		createSelectAllPayload(data.content, data.view, data.splitPath),
	{
		/**
		 * Apply the selection effect to the editor.
		 */
		applySelection(
			payload: InternalSelectAllPayload,
			effect: UserEffectFor<"SelectAll">,
		): void {
			const { from, to } = effect.selection;
			payload.view.dispatch({
				selection: { anchor: from, head: to },
			});
		},
	},
);
