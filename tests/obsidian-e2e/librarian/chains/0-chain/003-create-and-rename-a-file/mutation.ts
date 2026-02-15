/// <reference types="@wdio/globals/types" />
import { waitForIdle } from "../../../../support/api/idle";
import { createFile, renamePath } from "../../../../support/api/vault-ops";

export async function performMutation003(): Promise<void> {
	// Step 1: Create a new file with correct suffix directly
	// (simulating a file that was already healed or created correctly)
	const originalPath = "Library/Recipe/Pie/Berry/MyNote-Berry-Pie-Recipe.md";
	const createResult = await createFile(
		originalPath,
		"# New scroll content",
	);
	if (createResult.isErr()) {
		throw new Error(`Failed to create file: ${createResult.error}`);
	}

	// Wait for codexes to be updated with MyNote
	await waitForIdle();

	// Step 2: User renames the file coreName to "Renamed" (keeping suffix)
	// This simulates user renaming MyNote-Berry-Pie-Recipe.md to Renamed-Berry-Pie-Recipe.md
	// Bug: codexes should update to reflect Renamed but they still show MyNote
	const renamedPath = "Library/Recipe/Pie/Berry/Renamed-Berry-Pie-Recipe.md";
	const renameResult = await renamePath(originalPath, renamedPath);
	if (renameResult.isErr()) {
		throw new Error(`Failed to rename file from ${originalPath} to ${renamedPath}: ${renameResult.error}`);
	}

	// Wait for healing after rename
	await waitForIdle();
}
