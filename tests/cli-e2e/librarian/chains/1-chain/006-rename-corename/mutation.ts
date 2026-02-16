import { createFile, renamePath, waitForIdle } from "../../../../utils";

export async function performMutation006(): Promise<void> {
	// Step 1: Create a new file WITHOUT suffix (simulates user creating via Obsidian)
	const pathNoSuffix = "Library/Recipe/Soup/Ramen/Untitled.md";
	await createFile(pathNoSuffix, "# Untitled note content");

	// Wait for healing to add suffix: Untitled.md -> Untitled-Ramen-Soup-Recipe.md
	await waitForIdle();

	// Step 2: User renames coreName (Untitled -> Draft)
	const pathAfterHeal = "Library/Recipe/Soup/Ramen/Untitled-Ramen-Soup-Recipe.md";
	const path2 = "Library/Recipe/Soup/Ramen/Draft-Ramen-Soup-Recipe.md";
	await renamePath(pathAfterHeal, path2);
	await waitForIdle();

	// Step 3: User renames again (Draft -> Review)
	const path3 = "Library/Recipe/Soup/Ramen/Review-Ramen-Soup-Recipe.md";
	await renamePath(path2, path3);
	await waitForIdle();

	// Step 4: User renames again (Review -> Final)
	const path4 = "Library/Recipe/Soup/Ramen/Final-Ramen-Soup-Recipe.md";
	await renamePath(path3, path4);
	await waitForIdle();
}
