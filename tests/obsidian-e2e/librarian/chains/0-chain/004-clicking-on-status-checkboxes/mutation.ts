/// <reference types="@wdio/globals/types" />
import { clickCodexCheckbox } from "../../../../support/api/vault-ops";

/**
 * Scenario 1: Click the Steps checkbox in Berry codex.
 * This should mark the Steps scroll as done.
 */
export async function performMutation004_scenario1(): Promise<void> {
	const codexPath = "Library/Recipe/Pie/Berry/__-Berry-Pie-Recipe.md";
	const linkTarget = "Steps-Berry-Pie-Recipe";

	const result = await clickCodexCheckbox(codexPath, linkTarget);
	if (result.isErr()) {
		throw new Error(`Failed to click checkbox for ${linkTarget}: ${result.error}`);
	}
}

/**
 * Scenario 2: Click the remaining scroll checkboxes in Berry (Ingredients, Renamed).
 * After this, all Berry scrolls are done, so Berry section should become done in Pie codex.
 */
export async function performMutation004_scenario2(): Promise<void> {
	const codexPath = "Library/Recipe/Pie/Berry/__-Berry-Pie-Recipe.md";

	// Click Ingredients checkbox
	const ingredientsResult = await clickCodexCheckbox(codexPath, "Ingredients-Berry-Pie-Recipe");
	if (ingredientsResult.isErr()) {
		throw new Error(`Failed to click checkbox for Ingredients: ${ingredientsResult.error}`);
	}

	// Click Renamed checkbox
	const renamedResult = await clickCodexCheckbox(codexPath, "Renamed-Berry-Pie-Recipe");
	if (renamedResult.isErr()) {
		throw new Error(`Failed to click checkbox for Renamed: ${renamedResult.error}`);
	}
}

/**
 * Scenario 3: Click the Fish section checkbox in Pie codex.
 * This should propagate Done status to all Fish descendants.
 */
export async function performMutation004_scenario3(): Promise<void> {
	const codexPath = "Library/Recipe/Pie/__-Pie-Recipe.md";
	const linkTarget = "__-Fish-Pie-Recipe";

	const result = await clickCodexCheckbox(codexPath, linkTarget);
	if (result.isErr()) {
		throw new Error(`Failed to click checkbox for Fish section: ${result.error}`);
	}
}

/**
 * Scenario 4: Click the Fish section checkbox again (uncheck).
 * This should propagate NotStarted status to all Fish descendants.
 */
export async function performMutation004_scenario4(): Promise<void> {
	const codexPath = "Library/Recipe/Pie/__-Pie-Recipe.md";
	const linkTarget = "__-Fish-Pie-Recipe";

	const result = await clickCodexCheckbox(codexPath, linkTarget);
	if (result.isErr()) {
		throw new Error(`Failed to click checkbox for Fish section: ${result.error}`);
	}
}
