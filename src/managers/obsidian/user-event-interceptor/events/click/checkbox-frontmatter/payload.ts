/**
 * CheckboxFrontmatterPayload - payload for property checkbox clicks in frontmatter.
 */

import { z } from "zod";
import { SplitPathToMdFileSchema } from "../../../../vault-action-manager/types/split-path";
import { PayloadKind } from "../../../types/payload-base";

export const CheckboxFrontmatterPayloadSchema = z.object({
	/** New state after click */
	checked: z.boolean(),
	kind: z.literal(PayloadKind.CheckboxInFrontmatterClicked),
	/** Property name (e.g., "status") */
	propertyName: z.string(),
	/** File where property checkbox was clicked */
	splitPath: SplitPathToMdFileSchema,
});

export type CheckboxFrontmatterPayload = z.infer<
	typeof CheckboxFrontmatterPayloadSchema
>;

/**
 * Create a checkbox frontmatter payload.
 */
export function createCheckboxFrontmatterPayload(
	splitPath: CheckboxFrontmatterPayload["splitPath"],
	checked: boolean,
	propertyName: string,
): CheckboxFrontmatterPayload {
	return {
		checked,
		kind: PayloadKind.CheckboxInFrontmatterClicked,
		propertyName,
		splitPath,
	};
}
