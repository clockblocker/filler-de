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

/** Wikilink target: [[basename]] or [[basename|alias]] */
export const WikiTargetSchema = z.object({
	alias: z.string().optional(),
	basename: z.string(),
});

export type WikiTarget = z.infer<typeof WikiTargetSchema>;

export const WikilinkClickPayloadSchema = z.object({
	/** Full line/block content where link is located */
	blockContent: z.string(),
	kind: z.literal(PayloadKind.WikilinkClicked),
	/** Modifier keys held during click */
	modifiers: ModifiersSchema,
	/** File where link was clicked */
	splitPath: SplitPathToMdFileSchema,
	/** Wikilink target info */
	wikiTarget: WikiTargetSchema,
});

export type WikilinkClickPayload = z.infer<typeof WikilinkClickPayloadSchema>;

/**
 * Create a wikilink click payload.
 */
export function createWikilinkClickPayload(
	wikiTarget: WikiTarget,
	blockContent: string,
	splitPath: WikilinkClickPayload["splitPath"],
	modifiers: Modifiers,
): WikilinkClickPayload {
	return {
		blockContent,
		kind: PayloadKind.WikilinkClicked,
		modifiers,
		splitPath,
		wikiTarget,
	};
}
