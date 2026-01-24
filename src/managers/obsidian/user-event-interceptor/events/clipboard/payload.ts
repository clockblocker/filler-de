/**
 * ClipboardPayload - payload for clipboard copy/cut events.
 */

import { z } from "zod";
import { SplitPathToMdFileSchema } from "../../../vault-action-manager/types/split-path";
import { PayloadKind } from "../../types/payload-base";

export const ClipboardPayloadSchema = z.object({
	/** True if cut, false if copy */
	isCut: z.boolean(),
	kind: z.literal(PayloadKind.ClipboardCopy),
	/** Modified text set by behaviors (used by codec.decode) */
	modifiedText: z.string().optional(),
	/** Original selected text */
	originalText: z.string(),
	/** File where clipboard event occurred (optional - may not have active file) */
	splitPath: SplitPathToMdFileSchema.optional(),
});

export type ClipboardPayload = z.infer<typeof ClipboardPayloadSchema>;

/**
 * Create a clipboard payload from raw event data.
 */
export function createClipboardPayload(
	originalText: string,
	isCut: boolean,
	splitPath?: ClipboardPayload["splitPath"],
): ClipboardPayload {
	return {
		isCut,
		kind: PayloadKind.ClipboardCopy,
		originalText,
		splitPath,
	};
}
