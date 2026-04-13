import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import { z } from "zod";
import { PayloadKind } from "../../types/payload-base";
import { toSourcePath } from "../source-path";

export const ClipboardPayloadSchema = z.object({
	/** True if cut, false if copy */
	isCut: z.boolean(),
	kind: z.literal(PayloadKind.ClipboardCopy),
	/** Original selected text */
	originalText: z.string(),
	/** File where clipboard event occurred (optional - may not have active file) */
	sourcePath: z.string().optional(),
});

export type ClipboardPayload = z.infer<typeof ClipboardPayloadSchema>;

/**
 * Create a clipboard payload from raw event data.
 */
export function createClipboardPayload(
	originalText: string,
	isCut: boolean,
	splitPath?: SplitPathToMdFile,
): ClipboardPayload {
	return {
		isCut,
		kind: PayloadKind.ClipboardCopy,
		originalText,
		sourcePath: toSourcePath(splitPath),
	};
}
