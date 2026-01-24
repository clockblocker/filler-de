/**
 * WikilinkPayload - payload for wikilink completion events.
 */

import type { EditorView } from "@codemirror/view";
import { z } from "zod";
import { PayloadKind } from "../../types/payload-base";

/**
 * Note: EditorView cannot be validated by Zod, so we use a partial schema
 * and add the view at runtime.
 */
export const WikilinkPayloadSchemaPartial = z.object({
	/** Alias to insert (set by behaviors) */
	aliasToInsert: z.string().optional(),
	/** Position before ]] */
	closePos: z.number(),
	kind: z.literal(PayloadKind.WikilinkCompleted),
	/** Raw content between [[ and ]] */
	linkContent: z.string(),
});

export type WikilinkPayload = z.infer<typeof WikilinkPayloadSchemaPartial> & {
	/** EditorView for inserting alias */
	view: EditorView;
};

/**
 * Create a wikilink payload.
 */
export function createWikilinkPayload(
	linkContent: string,
	closePos: number,
	view: EditorView,
): WikilinkPayload {
	return {
		closePos,
		kind: PayloadKind.WikilinkCompleted,
		linkContent,
		view,
	};
}
