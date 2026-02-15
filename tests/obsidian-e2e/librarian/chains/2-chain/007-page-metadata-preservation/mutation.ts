/// <reference types="@wdio/globals/types" />
import { clickCodexCheckbox } from "../../../../support/api/vault-ops";

/**
 * Click the Page_001 checkbox in Aschenputtel codex.
 * This should mark page 1 as done while preserving navigation indices.
 */
export async function performMutation007_togglePage1(): Promise<void> {
	const codexPath = "Library/Märchen/Aschenputtel/__-Aschenputtel-Märchen.md";
	// Link target for page 1 (the basename without extension)
	const linkTarget = "Aschenputtel_Page_001-Aschenputtel-Märchen";

	const result = await clickCodexCheckbox(codexPath, linkTarget);
	if (result.isErr()) {
		throw new Error(`Failed to click checkbox for Page_001: ${result.error}`);
	}
}

/**
 * Click the Page_001 checkbox again to toggle it back to unchecked.
 * This verifies metadata is preserved on both check and uncheck.
 */
export async function performMutation007_untogglePage1(): Promise<void> {
	const codexPath = "Library/Märchen/Aschenputtel/__-Aschenputtel-Märchen.md";
	const linkTarget = "Aschenputtel_Page_001-Aschenputtel-Märchen";

	const result = await clickCodexCheckbox(codexPath, linkTarget);
	if (result.isErr()) {
		throw new Error(`Failed to uncheck checkbox for Page_001: ${result.error}`);
	}
}
