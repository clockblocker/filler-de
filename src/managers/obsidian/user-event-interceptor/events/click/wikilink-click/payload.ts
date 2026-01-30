/**
 * WikilinkClickPayload - payload for internal link (wikilink) clicks.
 */

import { z } from "zod";
import { SplitPathToMdFileSchema } from "../../../../vault-action-manager/types/split-path";
import { PayloadKind } from "../../../types/payload-base";

export const ModifiersSchema = z.object({
	alt: z.boolean(),
	ctrl: z.boolean(),
	meta: z.boolean(),
	shift: z.boolean(),
});

export type Modifiers = z.infer<typeof ModifiersSchema>;

export const WikilinkClickPayloadSchema = z.object({
	/** Full line/block content where link is located */
	blockContent: z.string(),
	/** Display text - alias or target */
	displayText: z.string(),
	kind: z.literal(PayloadKind.WikilinkClicked),
	/** Link target - the [[target]] content */
	linkTarget: z.string(),
	/** Modifier keys held during click */
	modifiers: ModifiersSchema,
	/** File where link was clicked */
	splitPath: SplitPathToMdFileSchema,
});

export type WikilinkClickPayload = z.infer<typeof WikilinkClickPayloadSchema>;

/**
 * Create a wikilink click payload.
 */
export function createWikilinkClickPayload(
	linkTarget: string,
	displayText: string,
	blockContent: string,
	splitPath: WikilinkClickPayload["splitPath"],
	modifiers: Modifiers,
): WikilinkClickPayload {
	return {
		blockContent,
		displayText,
		kind: PayloadKind.WikilinkClicked,
		linkTarget,
		modifiers,
		splitPath,
	};
}
