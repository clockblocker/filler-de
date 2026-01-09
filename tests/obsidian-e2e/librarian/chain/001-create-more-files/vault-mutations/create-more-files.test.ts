/// <reference types="@wdio/globals/types" />
import { expect } from "@wdio/globals";
import { createFiles } from "../../../../helpers/vault-ops";

export async function createMoreFiles(): Promise<void> {
	await createFiles([
		// Library root files
		{ path: "Library/Steps-Pie-Berry_Pie-Recipe.md" },
		{ path: "Library/Avatar-S1-E2.md" },
		{ path: "Library/Avatar-S2-E1.md" },
		// Berry_Pie folder
		{ path: "Library/Recipe/Berry_Pie/Ingredients.md" },
		{ path: "Library/Recipe/Berry_Pie/Result_picture-Berry_Pie.jpg" },
		// Ramen folder
		{ path: "Library/Recipe/Soup/Ramen/Ingredients.md" },
		{ path: "Library/Recipe/Soup/Ramen/Steps.md" },
		{ path: "Library/Recipe/Soup/Ramen/Result_picture.jpg" },
	]);
}

