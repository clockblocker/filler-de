/// <reference types="@wdio/globals/types" />
import { expect } from "@wdio/globals";
import { waitForFiles } from "../../helpers/polling";

export async function testAllCodexesCreatedOnInit(): Promise<void> {
	const [rootCodex, recipeCodex, pieCodex] = await waitForFiles([
		"Library/__-Library.md",
		"Library/Recipe/__-Recipe.md",
		"Library/Recipe/Pie/__-Pie-Recipe.md",
	]);

	expect(rootCodex).toBe(true);
	expect(recipeCodex).toBe(true);
	expect(pieCodex).toBe(true);
}

