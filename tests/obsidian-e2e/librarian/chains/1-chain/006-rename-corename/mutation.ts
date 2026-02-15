/// <reference types="@wdio/globals/types" />
import { waitForIdle } from "../../../../support/api/idle";
import { createFile, renamePath } from "../../../../support/api/vault-ops";

export async function performMutation006(): Promise<void> {
	// Step 1: Create a new file WITHOUT suffix (simulates user creating via Obsidian)
	const pathNoSuffix = "Library/Recipe/Soup/Ramen/Untitled.md";
	const createResult = await createFile(pathNoSuffix, "# Untitled note content");
	if (createResult.isErr()) {
		throw new Error(`Failed to create file: ${createResult.error}`);
	}

	// Wait for healing to add suffix: Untitled.md -> Untitled-Ramen-Soup-Recipe.md
	await waitForIdle();

	// Step 2: User renames coreName (Untitled -> Draft)
	// The file is now at Untitled-Ramen-Soup-Recipe.md after healing
	const pathAfterHeal = "Library/Recipe/Soup/Ramen/Untitled-Ramen-Soup-Recipe.md";
	const path2 = "Library/Recipe/Soup/Ramen/Draft-Ramen-Soup-Recipe.md";
	const rename1 = await renamePath(pathAfterHeal, path2);
	if (rename1.isErr()) {
		throw new Error(`Failed to rename to Draft: ${rename1.error}`);
	}
	await waitForIdle();

	// Step 3: User renames again (Draft -> Review)
	const path3 = "Library/Recipe/Soup/Ramen/Review-Ramen-Soup-Recipe.md";
	const rename2 = await renamePath(path2, path3);
	if (rename2.isErr()) {
		throw new Error(`Failed to rename to Review: ${rename2.error}`);
	}
	await waitForIdle();

	// Step 4: User renames again (Review -> Final)
	const path4 = "Library/Recipe/Soup/Ramen/Final-Ramen-Soup-Recipe.md";
	const rename3 = await renamePath(path3, path4);
	if (rename3.isErr()) {
		throw new Error(`Failed to rename to Final: ${rename3.error}`);
	}
	await waitForIdle();
}
