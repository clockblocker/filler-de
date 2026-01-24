/**
 * SelectionChangedCodec - encodes selection change data into payload.
 */

import type { SplitPathToMdFile } from "../../../vault-action-manager/types/split-path";
import type { SelectionChangedPayload } from "./payload";
import { createSelectionChangedPayload } from "./payload";

export type SelectionChangedData = {
	hasSelection: boolean;
	selectedText: string;
	source: SelectionChangedPayload["source"];
	splitPath?: SplitPathToMdFile;
};

export const SelectionChangedCodec = {
	/**
	 * Encode selection change data into a payload.
	 */
	encode(data: SelectionChangedData): SelectionChangedPayload {
		return createSelectionChangedPayload(
			data.hasSelection,
			data.selectedText,
			data.source,
			data.splitPath,
		);
	},
};
