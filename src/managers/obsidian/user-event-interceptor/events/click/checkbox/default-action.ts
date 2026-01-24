/**
 * Default action for checkbox events.
 *
 * Checkbox clicks typically don't need a default action as
 * Obsidian handles the checkbox toggle. Behaviors may intercept
 * for custom logic (e.g., updating codex checkboxes).
 */

import type { ChainResult } from "../../../types/transform-kind";
import type { CheckboxPayload } from "./payload";

/**
 * Execute the default checkbox action after behavior chain.
 */
export async function executeCheckboxDefaultAction(
	result: ChainResult<CheckboxPayload>,
): Promise<void> {
	switch (result.outcome) {
		case "skipped":
			// Do nothing - behavior chain decided to skip
			return;

		case "replaced":
			// Run the replacement action
			await result.action();
			return;

		case "completed":
			// Default behavior: Obsidian handles checkbox toggle
			// No additional action needed
			return;
	}
}
