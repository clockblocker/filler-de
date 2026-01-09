/// <reference types="@wdio/globals/types" />
import { expectFilesToExist } from "../../../../helpers/assertions";

const EXPECTED_CODEXES = [
	"Library/__-Library.md",
	"Library/Recipe/__-Recipe.md",
	"Library/Recipe/Pie/__-Pie-Recipe.md",
	"Library/Recipe/Soup/__-Soup-Recipe.md",
	"Library/Recipe/Soup/Pho_Bo/__-Pho_Bo-Soup-Recipe.md",
];

export async function testAllCodexesCreatedOnInit(): Promise<void> {
	await expectFilesToExist(EXPECTED_CODEXES);
}
