/**
 * SelectionChangedPayload - payload for text selection change events.
 */

import { z } from "zod";
import { SplitPathToMdFileSchema } from "../../../vault-action-manager/types/split-path";
import { PayloadKind } from "../../types/payload-base";

export const SelectionChangedPayloadSchema = z.object({
	kind: z.literal(PayloadKind.SelectionChanged),
	/** File where selection changed (optional) */
	splitPath: SplitPathToMdFileSchema.optional(),
	/** True if there's currently a text selection */
	hasSelection: z.boolean(),
	/** The selected text (empty string if no selection) */
	selectedText: z.string(),
	/** Source of the selection change */
	source: z.enum(["mouse", "keyboard", "drag"]),
});

export type SelectionChangedPayload = z.infer<
	typeof SelectionChangedPayloadSchema
>;

/**
 * Create a selection changed payload.
 */
export function createSelectionChangedPayload(
	hasSelection: boolean,
	selectedText: string,
	source: SelectionChangedPayload["source"],
	splitPath?: SelectionChangedPayload["splitPath"],
): SelectionChangedPayload {
	return {
		hasSelection,
		kind: PayloadKind.SelectionChanged,
		selectedText,
		source,
		splitPath,
	};
}
