/// <reference types="@wdio/globals/types" />
import { expect } from "@wdio/globals";
import { waitForFiles } from "../../../../../helpers/polling";


export async function testCreatedFilesHaveCanonicalSuffixes(): Promise<void> {
	const files = await waitForFiles([
		// Berry_Pie folder - files should have -Berry_Pie-Recipe suffix
		"Library/Recipe/Berry_Pie/Ingredients-Berry_Pie-Recipe.md",
		"Library/Recipe/Berry_Pie/Result_picture-Berry_Pie-Recipe.jpg",
		"Library/Recipe/Berry_Pie/Steps-Berry_Pie-Recipe.md",
		
		// Ramen folder - files should have -Ramen-Soup-Recipe suffix
		"Library/Recipe/Soup/Ramen/Ingredients-Ramen-Soup-Recipe.md",
		"Library/Recipe/Soup/Ramen/Steps-Ramen-Soup-Recipe.md",
		"Library/Recipe/Soup/Ramen/Result_picture-Ramen-Soup-Recipe.jpg",
		
		// Outside Library files - should NOT have suffixes
		"Outside/Avatar-S1-E1.md",
		"Outside/Avatar-S1-E2.md",
		"Outside/Avatar-S2-E1.md",
	]);

	for (const file of files) {
		expect(file).toBe(true);
	}
}

