/**
 * SelectAllPayload - payload for Ctrl/Cmd+A select-all events.
 */

import type { EditorView } from "@codemirror/view";
import { z } from "zod";
import { SplitPathToMdFileSchema } from "../../../vault-action-manager/types/split-path";
import { PayloadKind } from "../../types/payload-base";

/**
 * Note: EditorView cannot be validated by Zod, so we use a partial schema
 * and add the view at runtime.
 */
export const SelectAllPayloadSchemaPartial = z.object({
	/** Full document content */
	content: z.string(),
	/** Custom selection range set by behaviors (from, to) */
	customSelection: z
		.object({
			from: z.number(),
			to: z.number(),
		})
		.optional(),
	kind: z.literal(PayloadKind.SelectAll),
	/** File where select-all was triggered (optional) */
	splitPath: SplitPathToMdFileSchema.optional(),
});

export type SelectAllPayload = z.infer<typeof SelectAllPayloadSchemaPartial> & {
	/** CodeMirror view for dispatching selection changes */
	view: EditorView;
};

/**
 * Create a select-all payload.
 */
export function createSelectAllPayload(
	content: string,
	view: EditorView,
	splitPath?: SelectAllPayload["splitPath"],
): SelectAllPayload {
	return {
		content,
		kind: PayloadKind.SelectAll,
		splitPath,
		view,
	};
}
