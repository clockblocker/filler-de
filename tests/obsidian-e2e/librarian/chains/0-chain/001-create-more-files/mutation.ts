/// <reference types="@wdio/globals/types" />
import { createFiles } from "../../../../support/api/vault-ops";

export async function performMutation001(): Promise<void> {
	const result = await createFiles([
		// Create Berry_Pie folder with files (without proper suffixes)
		{ content: "", path: "Library/Recipe/Berry_Pie/Ingredients.md" },
		{ content: "", path: "Library/Recipe/Berry_Pie/Steps.md" },
		{ content: "", path: "Library/Recipe/Berry_Pie/Result_picture.jpg" },
		// Create new Avatar files
		{ content: "", path: "Outside/Avatar-S1-E2.md" },
		{ content: "", path: "Outside/Avatar-S2-E1.md" },
		// Create root level files (should be moved/healed)
		{ content: "", path: "Library/Ingredients-Ramen-Soup-Recipe.md" },
		{ content: "", path: "Library/Steps-Ramen-Soup-Recipe.md" },
		{ content: "", path: "Library/Result_picture-Ramen-Soup-Recipe.jpg" },
	]);
	if (result.isErr()) {
		throw new Error(`Failed to create files: ${result.error}`);
	}
}