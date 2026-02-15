/**
 * CheckboxCodec - encodes checkbox click data into payload.
 */

import type { SplitPathToMdFile } from "../../../../vault-action-manager/types/split-path";
import type { CheckboxPayload } from "./payload";
import { createCheckboxPayload } from "./payload";

export type CheckboxClickData = {
	splitPath: SplitPathToMdFile;
	checked: boolean;
	lineContent: string;
};

export const CheckboxCodec = {
	/**
	 * Encode checkbox click data into a payload.
	 */
	encode(data: CheckboxClickData): CheckboxPayload {
		return createCheckboxPayload(
			data.splitPath,
			data.checked,
			data.lineContent,
		);
	},
};
