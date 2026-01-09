/// <reference types="@wdio/globals/types" />
import { expect } from "@wdio/globals";
import { waitForFile } from "../../helpers/polling";

/**
 * Test: Codex files are created on init for sections with content.
 *
 * Scenario:
 * Vault contains: Library/A/B/Note-B-A.md
 * Sections: Library, A, B
 *
 * On plugin init:
 * Expected codexes:
 * - Library/__-Library.md (root codex)
 * - Library/A/__-A.md (section A codex)
 * - Library/A/B/__-B-A.md (section B codex)
 */
export async function testCodexCreatedOnInit(): Promise<void> {
	// Root codex
	const rootCodex = await waitForFile("Library/__-Library.md");
	expect(rootCodex).toBe(true);

	// Section A codex
	const sectionACodex = await waitForFile("Library/A/__-A.md");
	expect(sectionACodex).toBe(true);

	// Section B codex (nested)
	const sectionBCodex = await waitForFile("Library/A/B/__-B-A.md");
	expect(sectionBCodex).toBe(true);
}

/**
 * Test: Codex for deeply nested section has correct naming.
 *
 * Scenario:
 * Vault contains: Library/grandpa/father/kid/Diary-kid-father-grandpa.md
 *
 * Expected codexes:
 * - Library/__-Library.md
 * - Library/grandpa/__-grandpa.md
 * - Library/grandpa/father/__-father-grandpa.md
 * - Library/grandpa/father/kid/__-kid-father-grandpa.md
 */
export async function testCodexNamingDeeplyNested(): Promise<void> {
	const extraWait = { timeoutOffset: 2000 };

	const rootCodex = await waitForFile("Library/__-Library.md", extraWait);
	const grandpaCodex = await waitForFile("Library/grandpa/__-grandpa.md", extraWait);
	const fatherCodex = await waitForFile("Library/grandpa/father/__-father-grandpa.md", extraWait);
	const kidCodex = await waitForFile("Library/grandpa/father/kid/__-kid-father-grandpa.md", extraWait);

	expect(rootCodex).toBe(true);
	expect(grandpaCodex).toBe(true);
	expect(fatherCodex).toBe(true);
	expect(kidCodex).toBe(true);
}
