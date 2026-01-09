/// <reference types="@wdio/globals/types" />
import { expect } from "@wdio/globals";
import { OFFSET_AFTER_FILE_DELETION, waitForFile, waitForFileGone } from "../../helpers/polling";
import { createFile } from "../../helpers/vault-ops";

/**
 * Test: File created at Library root triggers NameKing healing.
 *
 * Scenario:
 * User creates: Library/Note.md
 *
 * Expected:
 * NameKing: basename defines path, so no suffix = stays at root
 * Library/Note.md (no suffix, stays at root)
 */
export async function testRootFileNoSuffix(): Promise<void> {
	const path = "Library/Note.md";

	await createFile(path, "# Root note");

	// Wait a bit for any potential healing
	await new Promise((r) => setTimeout(r, 500));

	// File should still be at same path (no suffix = root)
	const exists = await waitForFile(path);
	expect(exists).toBe(true);
}

/**
 * Test: File created in nested folder gets suffix added.
 *
 * Scenario:
 * User creates: Library/grandpa/father/son/Untitled.md
 *
 * Expected:
 * Library/grandpa/father/son/Untitled-son-father-grandpa.md
 */
export async function testNestedFileGetsSuffix(): Promise<void> {
	const createdPath = "Library/grandpa/father/son/Untitled.md";
	const expectedPath = "Library/grandpa/father/son/Untitled-son-father-grandpa.md";

	await createFile(createdPath, "# Untitled");

	// Should be renamed with suffix
	const healedExists = await waitForFile(expectedPath);
	const originalGone = await waitForFileGone(createdPath, OFFSET_AFTER_FILE_DELETION);

	expect(healedExists).toBe(true);
	expect(originalGone).toBe(true);
}

/**
 * Test: File created with correct suffix stays in place.
 *
 * Scenario:
 * User creates: Library/X1/Y1/Note-Y1-X1.md
 *
 * Expected:
 * Library/X1/Y1/Note-Y1-X1.md (no change)
 */
export async function testFileWithCorrectSuffixNoOp(): Promise<void> {
	const path = "Library/X1/Y1/Note-Y1-X1.md";

	await createFile(path, "# Correct suffix");

	// Wait a bit for any potential healing
	await new Promise((r) => setTimeout(r, 500));

	// File should still be at same path
	const exists = await waitForFile(path);
	expect(exists).toBe(true);
}

/**
 * Test: File created with wrong suffix gets healed.
 *
 * Scenario:
 * User creates: Library/X2/Y2/Note-X-Y.md (wrong suffix)
 *
 * Expected:
 * Library/X2/Y2/Note-Y2-X2.md (suffix fixed to match path)
 */
export async function testFileWithWrongSuffixHealed(): Promise<void> {
	const createdPath = "Library/X2/Y2/Note-X-Y.md";
	const expectedPath = "Library/X2/Y2/Note-Y2-X2.md";

	await createFile(createdPath, "# Wrong suffix");

	const healedExists = await waitForFile(expectedPath);
	const originalGone = await waitForFileGone(createdPath, OFFSET_AFTER_FILE_DELETION);

	expect(healedExists).toBe(true);
	expect(originalGone).toBe(true);
}

