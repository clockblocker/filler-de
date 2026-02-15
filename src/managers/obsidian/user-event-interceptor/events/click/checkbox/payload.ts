/**
 * CheckboxPayload - payload for task checkbox clicks in content.
 */

import { z } from "zod";
import { SplitPathToMdFileSchema } from "../../../../vault-action-manager/types/split-path";
import { PayloadKind } from "../../../types/payload-base";

export const CheckboxPayloadSchema = z.object({
	/** New state after click (checkbox.checked) */
	checked: z.boolean(),
	kind: z.literal(PayloadKind.CheckboxClicked),
	/** Line content after "- [ ] " or "- [x] " */
	lineContent: z.string(),
	/** File where checkbox was clicked */
	splitPath: SplitPathToMdFileSchema,
});

export type CheckboxPayload = z.infer<typeof CheckboxPayloadSchema>;

/**
 * Create a checkbox payload.
 */
export function createCheckboxPayload(
	splitPath: CheckboxPayload["splitPath"],
	checked: boolean,
	lineContent: string,
): CheckboxPayload {
	return {
		checked,
		kind: PayloadKind.CheckboxClicked,
		lineContent,
		splitPath,
	};
}
