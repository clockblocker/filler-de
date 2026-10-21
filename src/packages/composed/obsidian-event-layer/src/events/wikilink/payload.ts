/**
 * WikilinkPayload - payload for wikilink completion events.
 */

import type { EditorView } from "@codemirror/view";
import { z } from "zod";
import { PayloadKind } from "../../types/payload-base";
import type { CompletedLink } from "./link-at";

/**
 * Note: EditorView cannot be validated by Zod, so we use a partial schema
 * and add the view at runtime.
 */
const WikilinkPayloadSchemaPartial = z.object({
	/** Whether the link is an embed, `![[…]]` */
	embed: z.boolean(),
	kind: z.literal(PayloadKind.WikilinkCompleted),
	/** Content between [[ and ]], trimmed */
	linkContent: z.string(),
	/** The path Obsidian resolves the link to from its source note, if any */
	resolvedPath: z.string().optional(),
	sourcePath: z.string().optional(),
});

type WikilinkPayload = z.infer<typeof WikilinkPayloadSchemaPartial>;

export type InternalWikilinkPayload = WikilinkPayload & {
	/** Position before ]] */
	closePos: number;
	/** Position after [[, where the content starts, padding included */
	contentFrom: number;
	/** EditorView for inserting alias */
	view: EditorView;
};

/**
 * Create a wikilink payload.
 */
export function createWikilinkPayload(
	link: CompletedLink,
	view: EditorView,
): InternalWikilinkPayload {
	return {
		closePos: link.closePos,
		contentFrom: link.contentFrom,
		embed: link.embed,
		kind: PayloadKind.WikilinkCompleted,
		linkContent: link.linkContent,
		view,
	};
}
