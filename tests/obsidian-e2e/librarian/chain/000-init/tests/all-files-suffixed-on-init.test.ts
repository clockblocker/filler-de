/// <reference types="@wdio/globals/types" />
import { expectFilesToExist } from "../../../../helpers/assertions";

const EXPECTED_FILES = [
	// Pie
	"Library/Recipe/Pie/Ingredients-Pie-Recipe.md",
	"Library/Recipe/Pie/Steps-Pie-Recipe.md",
	"Library/Recipe/Pie/Result_picture-Pie-Recipe.jpg",
	
	// Pho Bo
	"Library/Recipe/Soup/Pho_Bo/Ingredients-Pho_Bo-Soup-Recipe.md",
	"Library/Recipe/Soup/Pho_Bo/Steps-Pho_Bo-Soup-Recipe.md",
	"Library/Recipe/Soup/Pho_Bo/Result_Picture-Pho_Bo-Soup-Recipe.jpg",
	
	// Outside Library files - should NOT have suffixes
	"Outside/Avatar-S1-E1.md",
];

export async function testAllFilesSuffixedOnInit(): Promise<void> {
	await expectFilesToExist(EXPECTED_FILES);
}

