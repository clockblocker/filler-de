/// <reference types="@wdio/globals/types" />
import { expect } from "@wdio/globals";
import { waitForFiles } from "../../helpers/polling";

export async function testAllCodexesCreatedOnInit(): Promise<void> {
	const [rootCodex, sectionACodex, sectionBCodex, grandpaCodex, fatherCodex, kidCodex] = await waitForFiles([
		"Library/__-Library.md",
		"Library/A/__-A.md",
		"Library/A/B/__-B-A.md",
		"Library/grandpa/__-grandpa.md",
		"Library/grandpa/father/__-father-grandpa.md",
		"Library/grandpa/father/kid/__-kid-father-grandpa.md",
	]);

	expect(rootCodex).toBe(true);
	expect(sectionACodex).toBe(true);
	expect(sectionBCodex).toBe(true);

	// Nested
	expect(grandpaCodex).toBe(true);
	expect(fatherCodex).toBe(true);
	expect(kidCodex).toBe(true);
}
