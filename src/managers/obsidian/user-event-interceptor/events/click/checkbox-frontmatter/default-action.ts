/**
 * Default action for checkbox frontmatter events.
 *
 * Property checkbox clicks are typically handled by behaviors
 * (e.g., Librarian updating codex completion status).
 */

import type { ChainResult } from "../../../types/transform-kind";
import type { CheckboxFrontmatterPayload } from "./payload";

/**
 * Execute the default checkbox frontmatter action after behavior chain.
 */
export async function executeCheckboxFrontmatterDefaultAction(
	result: ChainResult<CheckboxFrontmatterPayload>,
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
			// Default behavior: Obsidian handles property toggle
			// No additional action needed
			return;
	}
}
