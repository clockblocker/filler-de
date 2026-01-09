/// <reference types="@wdio/globals/types" />
import { expect } from "@wdio/globals";
import { waitForFiles } from "../../helpers/polling";

export async function testAllCodexesCreatedOnInit(): Promise<void> {
	const [rootCodex, recipeCodex, pieCodex] = await waitForFiles([
		"Library/__-Library.md",
		
		"Library/Recipe/__-Recipe.md",
		"Library/Recipe/Pie/__-Pie-Recipe.md",

		"Library/Recipe/Soup/__-Soup-Recipe.md",
		"Library/Recipe/Soup/Pho_Bo/__-Pho_Bo-Soup-Recipe.md",
	]);

	expect(rootCodex).toBe(true);
	expect(recipeCodex).toBe(true);
	expect(pieCodex).toBe(true);
}

export async function testAllFilesSuffixedOnInit(): Promise<void> {
	const [pieIngredientsFile, pieStepsFile, pieResultPictureFile, phoBoIngredientsFile, phoBoStepsFile, phoBoResultPictureFile] = await waitForFiles([
		// Pie
		"Library/Recipe/Pie/Ingredients-Pie-Recipe.md",
		"Library/Recipe/Pie/Steps-Pie-Recipe.md",
		"Library/Recipe/Pie/Result_picture-Pie-Recipe.jpg",
		// Pho Bo
		"Library/Recipe/Soup/Pho_Bo/Ingredients-Pho_Bo-Soup-Recipe.md",
		"Library/Recipe/Soup/Pho_Bo/Steps-Pho_Bo-Soup-Recipe.md",
		"Library/Recipe/Soup/Pho_Bo/Result_picture-Pho_Bo-Soup-Recipe.jpg",
	]);

	// Pie
	expect(pieIngredientsFile).toBe(true);	
	expect(pieStepsFile).toBe(true);
	expect(pieResultPictureFile).toBe(true);
	
	// Pho Bo
	expect(phoBoIngredientsFile).toBe(true);
	expect(phoBoStepsFile).toBe(true);
	expect(phoBoResultPictureFile).toBe(true);
}

