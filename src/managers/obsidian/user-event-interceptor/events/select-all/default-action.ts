/**
 * Default action for select-all events.
 *
 * If behaviors set a custom selection, apply it to the editor.
 * Otherwise, let native select-all proceed.
 */

import { EditorSelection } from "@codemirror/state";
import type { ChainResult } from "../../types/transform-kind";
import type { SelectAllPayload } from "./payload";

/**
 * Execute the default select-all action after behavior chain.
 */
export async function executeSelectAllDefaultAction(
	result: ChainResult<SelectAllPayload>,
): Promise<void> {
	switch (result.outcome) {
		case "skipped":
			// Do nothing - behavior chain decided to skip
			return;

		case "replaced":
			// Run the replacement action
			await result.action();
			return;

		case "completed": {
			// Apply custom selection if set by behaviors
			if (result.data.customSelection) {
				const { from, to } = result.data.customSelection;
				result.data.view.dispatch({
					selection: EditorSelection.single(from, to),
				});
			}
			// If no custom selection, native behavior already prevented
			// and nothing additional happens
			return;
		}
	}
}
