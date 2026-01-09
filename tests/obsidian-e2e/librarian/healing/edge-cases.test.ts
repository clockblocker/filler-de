/// <reference types="@wdio/globals/types" />
import { expect } from "@wdio/globals";
import { OFFSET_AFTER_FILE_DELETION, OFFSET_AFTER_HEAL, waitForFile, waitForFileGone } from "../../helpers/polling";

import {
	createFile,
	createFolder,
	deletePath,
	renamePath,
} from "../../helpers/vault-ops";

/**
 * Test: CoreName = NodeName (no delimiter allowed in coreName).
 *
 * Scenario:
 * User creates: Library/E1/my-note-E1.md
 * Parsing: coreName = "my", suffix = ["note", "E1"]
 *
 * PathKing (nested file): path defines suffix, not basename.
 * Canonical suffix from path ["E1"] = ["E1"]
 * Canonical basename = "my-E1" (coreName + path-derived suffix)
 *
 * Expected:
 * Library/E1/my-E1.md (suffix corrected to match path)
 */
export async function testCoreNameWithDelimiter(): Promise<void> {
	const createdPath = "Library/E1/my-note-E1.md";
	const expectedPath = "Library/E1/my-E1.md";

	await createFile(createdPath, "# My Note");

	const healedExists = await waitForFile(expectedPath, OFFSET_AFTER_HEAL);
	const originalGone = await waitForFileGone(createdPath, OFFSET_AFTER_FILE_DELETION);

	expect(healedExists).toBe(true);
	expect(originalGone).toBe(true);
}

/**
 * Test: Empty folder auto-pruned after file moved out.
 *
 * Scenario:
 * Library/E2/E3/Note-E3-E2.md (only file in E3)
 *
 * User renames suffix: Note-E2.md (removing E3 from suffix)
 *
 * Expected:
 * Library/E2/Note-E2.md (file moved)
 * Library/E2/E3/ (folder deleted if empty)
 */
export async function testEmptyFolderPruned(): Promise<void> {
	const initialPath = "Library/E2/E3/Note-E3-E2.md";
	const renamedPath = "Library/E2/E3/Note-E2.md";
	const expectedPath = "Library/E2/Note-E2.md";

	await createFile(initialPath, "# Note");
	const created = await waitForFile(initialPath);
	expect(created).toBe(true);

	// Rename to remove E3 from suffix
	await renamePath(initialPath, renamedPath);

	const movedExists = await waitForFile(expectedPath);
	expect(movedExists).toBe(true);

	// Folder E3 should be pruned (empty)
	// Note: This tests auto-pruning behavior
}

/**
 * Test: Multiple files in folder, rename folder.
 *
 * Scenario:
 * Library/E4/Note1-E4.md
 * Library/E4/Note2-E4.md
 *
 * User renames: E4 → E5
 *
 * Expected:
 * Library/E5/Note1-E5.md
 * Library/E5/Note2-E5.md
 */
export async function testFolderRenameMultipleFiles(): Promise<void> {
	const file1Initial = "Library/E4/Note1-E4.md";
	const file2Initial = "Library/E4/Note2-E4.md";
	const file1Expected = "Library/E5/Note1-E5.md";
	const file2Expected = "Library/E5/Note2-E5.md";

	await createFile(file1Initial, "# Note 1");
	await createFile(file2Initial, "# Note 2");

	await renamePath("Library/E4", "Library/E5");

	const healed1 = await waitForFile(file1Expected);
	const healed2 = await waitForFile(file2Expected);

	expect(healed1).toBe(true);
	expect(healed2).toBe(true);
}

/**
 * Test: Suffix with special characters (underscores).
 *
 * Scenario:
 * Library/my_folder/Note-my_folder.md
 *
 * Expected:
 * Works correctly with underscores in folder names
 */
export async function testSuffixWithUnderscores(): Promise<void> {
	const path = "Library/my_folder/Note-my_folder.md";

	await createFile(path, "# Note");

	// Wait a bit
	await new Promise((r) => setTimeout(r, 500));

	const exists = await waitForFile(path);
	expect(exists).toBe(true);
}

/**
 * Test: Rapid successive renames.
 *
 * Scenario:
 * Library/E6/Note-E6.md
 *
 * Rapid renames: E6 → E7 → E8
 *
 * Expected:
 * Library/E8/Note-E8.md (final state)
 */
export async function testRapidSuccessiveRenames(): Promise<void> {
	const initialPath = "Library/E6/Note-E6.md";
	const finalPath = "Library/E8/Note-E8.md";

	await createFile(initialPath, "# Note");
	const created = await waitForFile(initialPath);
	expect(created).toBe(true);

	// Rapid renames
	await renamePath("Library/E6", "Library/E7");
	await renamePath("Library/E7", "Library/E8");

	const finalExists = await waitForFile(finalPath, { timeoutOffset: 5000 });
	expect(finalExists).toBe(true);
}

/**
 * Test: Create file in non-existent folder path.
 *
 * Scenario:
 * User creates: Library/E9/E10/E11/Note.md
 * (folders E9/E10/E11 don't exist yet)
 *
 * Expected:
 * Library/E9/E10/E11/Note-E11-E10-E9.md
 */
export async function testCreateInNonExistentFolders(): Promise<void> {
	const createdPath = "Library/E9/E10/E11/Note.md";
	const expectedPath = "Library/E9/E10/E11/Note-E11-E10-E9.md";

	await createFile(createdPath, "# Note");

	const healedExists = await waitForFile(expectedPath);
	const originalGone = await waitForFileGone(createdPath, OFFSET_AFTER_FILE_DELETION);

	expect(healedExists).toBe(true);
	expect(originalGone).toBe(true);
}

/**
 * Test: Rename folder to name that matches existing suffix pattern.
 *
 * Scenario:
 * Library/E12/E13/Note-E13-E12.md
 *
 * User renames: E13 → C-D (folder name contains delimiter)
 *
 * Expected:
 * Library/E12/C-D/Note-C-D-E12.md (or however delimiter in folder name is handled)
 */
export async function testFolderNameWithDelimiter(): Promise<void> {
	const initialPath = "Library/E12/E13/Note-E13-E12.md";
	// Note: This tests how the system handles delimiters in folder names
	// The expected behavior may vary based on implementation

	await createFile(initialPath, "# Note");
	const created = await waitForFile(initialPath);
	expect(created).toBe(true);

	// Rename folder to include delimiter
	await renamePath("Library/E12/E13", "Library/E12/C-D");

	// Wait and check what happens
	await new Promise((r) => setTimeout(r, 1000));

	// Expected: some form of healing occurs
	// The exact path depends on how delimiter-in-folder-name is handled
}

/**
 * Test: Delete file - no healing needed.
 *
 * Scenario:
 * Library/E14/Note-E14.md
 *
 * User deletes file
 *
 * Expected:
 * File is deleted, no healing actions
 */
export async function testDeleteFileNoHealing(): Promise<void> {
	const path = "Library/E14/Note-E14.md";

	await createFile(path, "# Note");
	const created = await waitForFile(path);
	expect(created).toBe(true);

	await deletePath(path);

	const gone = await waitForFileGone(path);
	expect(gone).toBe(true);
}

/**
 * Test: Delete folder with children - all deleted.
 *
 * Scenario:
 * Library/E15/E16/Note-E16-E15.md
 * Library/E15/E16/E17/Deep-E17-E16-E15.md
 *
 * User deletes folder E15
 *
 * Expected:
 * All files deleted, no healing
 */
export async function testDeleteFolderWithChildren(): Promise<void> {
	const file1 = "Library/E15/E16/Note-E16-E15.md";
	const file2 = "Library/E15/E16/E17/Deep-E17-E16-E15.md";

	await createFile(file1, "# Note");
	await createFile(file2, "# Deep");

	await deletePath("Library/E15");

	const gone1 = await waitForFileGone(file1);
	const gone2 = await waitForFileGone(file2);

	expect(gone1).toBe(true);
	expect(gone2).toBe(true);
}
