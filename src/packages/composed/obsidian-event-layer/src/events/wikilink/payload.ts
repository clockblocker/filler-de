/**
 * WikilinkPayload - payload for wikilink completion events.
 */

import type { EditorView } from "@codemirror/view";
import { z } from "zod";
import { PayloadKind } from "../../types/payload-base";
import { toSourcePath } from "../source-path";

/**
 * Note: EditorView cannot be validated by Zod, so we use a partial schema
 * and add the view at runtime.
 */
const WikilinkPayloadSchemaPartial = z.object({
	canResolveNatively: z.boolean(),
	kind: z.literal(PayloadKind.WikilinkCompleted),
	/** Raw content between [[ and ]] */
	linkContent: z.string(),
	sourcePath: z.string().optional(),
});

export type WikilinkPayload = z.infer<typeof WikilinkPayloadSchemaPartial>;

export type InternalWikilinkPayload = WikilinkPayload & {
	/** Position before ]] */
	closePos: number;
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
	params?: {
		canResolveNatively: boolean;
		sourcePath?: {
			basename: string;
			extension: "md";
			kind: "MdFile";
			pathParts: string[];
		};
	},
): InternalWikilinkPayload {
	return {
		canResolveNatively: params?.canResolveNatively ?? false,
		closePos,
		kind: PayloadKind.WikilinkCompleted,
		linkContent,
		sourcePath: toSourcePath(params?.sourcePath),
		view,
	};
}
