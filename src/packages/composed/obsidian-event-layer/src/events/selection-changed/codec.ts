/**
 * SelectionChangedCodec - encodes selection change data into payload.
 */

import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { createEventCodec } from "../codec-factory";
import type { SelectionChangedPayload } from "./payload";
import { createSelectionChangedPayload } from "./payload";

type SelectionChangedData = {
	hasSelection: boolean;
	selectedText: string;
	source: SelectionChangedPayload["source"];
	splitPath?: SplitPathToMdFile;
};

export const SelectionChangedCodec = createEventCodec(
	/**
	 * Encode selection change data into a payload.
	 */
	(data: SelectionChangedData): SelectionChangedPayload =>
		createSelectionChangedPayload(
			data.hasSelection,
			data.selectedText,
			data.source,
			data.splitPath,
		),
);
