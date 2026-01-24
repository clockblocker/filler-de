import type { CodecRules, Codecs } from "../../../commanders/librarian/codecs";
import type { TreeAction } from "../../../commanders/librarian/healer/library-tree/tree-action/types/tree-action";
import { handlePropertyCheckboxClick } from "../../../commanders/librarian/user-event-router/handlers/checkbox-handler";
import {
	type CheckboxFrontmatterPayload,
	type EventHandler,
	HandlerOutcome,
} from "../../obsidian/user-event-interceptor";

/**
 * Function signature for enqueuing tree actions.
 */
export type EnqueueFn = (action: TreeAction) => Promise<void>;

/**
 * Create a handler for frontmatter property checkbox clicks.
 * Updates scroll status when clicking the status property checkbox.
 *
 * @param codecs - Codec instances for parsing
 * @param rules - Codec rules for path parsing
 * @param enqueue - Function to enqueue tree actions
 */
export function createCheckboxFrontmatterHandler(
	codecs: Codecs,
	rules: CodecRules,
	enqueue: EnqueueFn,
): EventHandler<CheckboxFrontmatterPayload> {
	return {
		doesApply: () => true, // Let the handler decide based on property name
		handle: (payload) => {
			const result = handlePropertyCheckboxClick(payload, codecs, rules);
			if (result) {
				// Enqueue the tree action (fire and forget)
				enqueue(result.action);
			}
			return { outcome: HandlerOutcome.Handled };
		},
	};
}
