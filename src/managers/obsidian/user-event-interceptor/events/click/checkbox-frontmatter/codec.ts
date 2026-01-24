/**
 * CheckboxFrontmatterCodec - encodes property checkbox click data into payload.
 */

import type { SplitPathToMdFile } from "../../../../vault-action-manager/types/split-path";
import type { CheckboxFrontmatterPayload } from "./payload";
import { createCheckboxFrontmatterPayload } from "./payload";

export type CheckboxFrontmatterClickData = {
	splitPath: SplitPathToMdFile;
	checked: boolean;
	propertyName: string;
};

export const CheckboxFrontmatterCodec = {
	/**
	 * Encode property checkbox click data into a payload.
	 */
	encode(data: CheckboxFrontmatterClickData): CheckboxFrontmatterPayload {
		return createCheckboxFrontmatterPayload(
			data.splitPath,
			data.checked,
			data.propertyName,
		);
	},
};
