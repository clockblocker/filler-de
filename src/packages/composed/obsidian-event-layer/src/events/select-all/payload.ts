/**
 * SelectAllPayload - payload for Ctrl/Cmd+A select-all events.
 */

import type { EditorView } from "@codemirror/view";
import { z } from "zod";
import { PayloadKind } from "../../types/payload-base";
import { toSourcePath } from "../source-path";

/**
 * Note: EditorView cannot be validated by Zod, so we use a partial schema
 * and add the view at runtime.
 */
const SelectAllPayloadSchemaPartial = z.object({
	/** Full document content */
	content: z.string(),
	kind: z.literal(PayloadKind.SelectAll),
	/** File where select-all was triggered (optional) */
	sourcePath: z.string().optional(),
});

export type SelectAllPayload = z.infer<typeof SelectAllPayloadSchemaPartial>;

export type InternalSelectAllPayload = SelectAllPayload & {
	/** CodeMirror view for dispatching selection changes */
	view: EditorView;
};

/**
 * Create a select-all payload.
 */
export function createSelectAllPayload(
	content: string,
	view: EditorView,
	splitPath?: {
		basename: string;
		extension: string;
		kind: string;
		pathParts: string[];
	},
): InternalSelectAllPayload {
	return {
		content,
		kind: PayloadKind.SelectAll,
		sourcePath: toSourcePath(
			splitPath as
				| {
						basename: string;
						extension: "md";
						kind: "MdFile";
						pathParts: string[];
				  }
				| undefined,
		),
		view,
	};
}
