import { createFile, renamePath, waitForIdle } from "../../../../utils";

export async function performMutation003(): Promise<void> {
	// Step 1: Create a new file with correct suffix directly
	const originalPath = "Library/Recipe/Pie/Berry/MyNote-Berry-Pie-Recipe.md";
	await createFile(originalPath, "# New scroll content");

	// Wait for codexes to be updated with MyNote
	await waitForIdle();

	// Step 2: User renames the file coreName to "Renamed" (keeping suffix)
	const renamedPath = "Library/Recipe/Pie/Berry/Renamed-Berry-Pie-Recipe.md";
	await renamePath(originalPath, renamedPath);

	// Wait for healing after rename
	await waitForIdle();
}
