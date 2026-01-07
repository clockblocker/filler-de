/// <reference types="@wdio/globals/types" />
import { expect } from "@wdio/globals";
import { waitForFile, waitForFileGone } from "../../helpers/polling";
import { renamePath } from "../../helpers/vault-ops";

/**
 * Test: Renaming a folder heals nested leaf suffixes.
 *
 * Scenario:
 * Library/grandpa/father/kid/Diary-kid-father-grandpa.md
 *
 * User renames: kid → son
 *
 * Expected:
 * Library/grandpa/father/son/Diary-son-father-grandpa.md
 */
export async function testFolderRenameHealsChildSuffix(): Promise<void> {
	const initialPath = "Library/grandpa/father/kid/Diary-kid-father-grandpa.md";
	const expectedPath = "Library/grandpa/father/son/Diary-son-father-grandpa.md";
	const wrongPath = "Library/grandpa/father/son/Diary-kid-father-grandpa.md";

	const initialExists = await waitForFile(initialPath);
	expect(initialExists).toBe(true);

	await renamePath("Library/grandpa/father/kid", "Library/grandpa/father/son");

	const healedExists = await waitForFile(expectedPath, { timeout: 3000 });
	const wrongGone = await waitForFileGone(wrongPath, { timeout: 500 });

	expect(healedExists).toBe(true);
	expect(wrongGone).toBe(true);
}

/**
 * Test: Renaming a deeply nested folder heals all descendant suffixes.
 *
 * Scenario:
 * Library/A/B/C/Note-C-B-A.md
 *
 * User renames: A → X
 *
 * Expected:
 * Library/X/B/C/Note-C-B-X.md
 */
export async function testDeepFolderRenameHealsAllDescendants(): Promise<void> {
	const initialPath = "Library/A/B/C/Note-C-B-A.md";
	const expectedPath = "Library/X/B/C/Note-C-B-X.md";

	const initialExists = await waitForFile(initialPath);
	expect(initialExists).toBe(true);

	await renamePath("Library/A", "Library/X");

	const healedExists = await waitForFile(expectedPath, { timeout: 3000 });
	expect(healedExists).toBe(true);
}

/**
 * Test: Renaming middle folder heals descendants but not ancestors.
 *
 * Scenario:
 * Library/A/B/Note-B-A.md
 *
 * User renames: B → Y
 *
 * Expected:
 * Library/A/Y/Note-Y-A.md
 */
export async function testMiddleFolderRenameHealsDescendants(): Promise<void> {
	const initialPath = "Library/A/B/Note-B-A.md";
	const expectedPath = "Library/A/Y/Note-Y-A.md";

	const initialExists = await waitForFile(initialPath);
	expect(initialExists).toBe(true);

	await renamePath("Library/A/B", "Library/A/Y");

	const healedExists = await waitForFile(expectedPath, { timeout: 3000 });
	expect(healedExists).toBe(true);
}

/**
 * Test: Renaming folder with suffix triggers move (NameKing for folders).
 *
 * Scenario:
 * Library/F1/Note-F1.md
 *
 * User renames folder: F1 → F1-F2
 * NameKing: folder suffix defines path
 * Parsing: nodeName = "F1", suffix = ["F2"]
 *
 * Expected:
 * Folder heals: Library/F1-F2 → Library/F2/F1
 * Then children suffixes update: Library/F2/F1/Note-F1-F2.md
 */
export async function testFolderRenameWithSuffixTriggersMove(): Promise<void> {
	const initialPath = "Library/F1/Note-F1.md";
	const expectedPath = "Library/F2/F1/Note-F1-F2.md";

	const initialExists = await waitForFile(initialPath);
	expect(initialExists).toBe(true);

	await renamePath("Library/F1", "Library/F1-F2");

	const healedExists = await waitForFile(expectedPath, { timeout: 3000 });
	expect(healedExists).toBe(true);
}

/**
 * Test: Renaming nested folder with suffix triggers move.
 *
 * Scenario:
 * Library/F3/F4/Note-F4-F3.md
 *
 * User renames folder: F4 → F4-F5
 * NameKing: folder suffix defines path
 * Parsing: nodeName = "F4", suffix = ["F5"]
 *
 * Expected:
 * Folder heals: Library/F3/F4-F5 → Library/F5/F4
 * Children suffixes update: Library/F5/F4/Note-F4-F5.md
 */
export async function testNestedFolderRenameWithSuffixTriggersMove(): Promise<void> {
	const initialPath = "Library/F3/F4/Note-F4-F3.md";
	const expectedPath = "Library/F5/F4/Note-F4-F5.md";

	const initialExists = await waitForFile(initialPath);
	expect(initialExists).toBe(true);

	await renamePath("Library/F3/F4", "Library/F3/F4-F5");

	const healedExists = await waitForFile(expectedPath, { timeout: 3000 });
	expect(healedExists).toBe(true);
}
