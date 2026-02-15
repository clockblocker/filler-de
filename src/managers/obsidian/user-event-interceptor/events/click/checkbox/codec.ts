/**
 * CheckboxCodec - encodes checkbox click data into payload.
 */

import type { SplitPathToMdFile } from "../../../../vault-action-manager/types/split-path";
import { createEventCodec } from "../../codec-factory";
import type { CheckboxPayload } from "./payload";
import { createCheckboxPayload } from "./payload";

export type CheckboxClickData = {
	splitPath: SplitPathToMdFile;
	checked: boolean;
	lineContent: string;
};

export const CheckboxCodec = createEventCodec(
	/**
	 * Encode checkbox click data into a payload.
	 */
	(data: CheckboxClickData): CheckboxPayload =>
		createCheckboxPayload(data.splitPath, data.checked, data.lineContent),
);
