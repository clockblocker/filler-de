/// <reference types="@wdio/globals/types" />
import { waitForIdle } from "../../../../support/api/idle";
import { createFile } from "../../../../support/api/vault-ops";

export async function performMutation007(): Promise<void> {
	// Create a new file WITHOUT suffix in a nested library folder
	// This simulates a user creating a new file via Obsidian
	const pathNoSuffix = "Library/Recipe/Soup/Ramen/NewScroll.md";
	const createResult = await createFile(
		pathNoSuffix,
		"# NewScroll\n\nThis is a new scroll without suffix."
	);
	if (createResult.isErr()) {
		throw new Error(`Failed to create file: ${createResult.error}`);
	}

	// Wait for healing to rename: NewScroll.md -> NewScroll-Ramen-Soup-Recipe.md
	await waitForIdle();
}
