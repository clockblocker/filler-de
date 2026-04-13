/**
 * CheckboxFrontmatterPayload - payload for property checkbox clicks in frontmatter.
 */

import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import { z } from "zod";
import { PayloadKind } from "../../../types/payload-base";
import { toSourcePath } from "../../source-path";

export const CheckboxFrontmatterPayloadSchema = z.object({
	/** New state after click */
	checked: z.boolean(),
	kind: z.literal(PayloadKind.CheckboxInFrontmatterClicked),
	/** Property name (e.g., "status") */
	propertyName: z.string(),
	/** File where property checkbox was clicked */
	sourcePath: z.string(),
});

export type CheckboxFrontmatterPayload = z.infer<
	typeof CheckboxFrontmatterPayloadSchema
>;

/**
 * Create a checkbox frontmatter payload.
 */
export function createCheckboxFrontmatterPayload(
	splitPath: SplitPathToMdFile,
	checked: boolean,
	propertyName: string,
): CheckboxFrontmatterPayload {
	return {
		checked,
		kind: PayloadKind.CheckboxInFrontmatterClicked,
		propertyName,
		sourcePath: toSourcePath(splitPath) ?? "",
	};
}
