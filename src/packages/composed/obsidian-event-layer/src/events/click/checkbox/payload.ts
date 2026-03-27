/**
 * CheckboxPayload - payload for task checkbox clicks in content.
 */

import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { z } from "zod";
import { PayloadKind } from "../../../types/payload-base";
import { toSourcePath } from "../../source-path";

export const CheckboxPayloadSchema = z.object({
	/** New state after click (checkbox.checked) */
	checked: z.boolean(),
	kind: z.literal(PayloadKind.CheckboxClicked),
	/** Line content after "- [ ] " or "- [x] " */
	lineContent: z.string(),
	/** File where checkbox was clicked */
	sourcePath: z.string(),
});

export type CheckboxPayload = z.infer<typeof CheckboxPayloadSchema>;

/**
 * Create a checkbox payload.
 */
export function createCheckboxPayload(
	splitPath: SplitPathToMdFile,
	checked: boolean,
	lineContent: string,
): CheckboxPayload {
	return {
		checked,
		kind: PayloadKind.CheckboxClicked,
		lineContent,
		sourcePath: toSourcePath(splitPath) ?? "",
	};
}
