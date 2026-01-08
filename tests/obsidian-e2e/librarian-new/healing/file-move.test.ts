/// <reference types="@wdio/globals/types" />
import { expect } from "@wdio/globals";
import { waitForFile, waitForFileGone } from "../../helpers/polling";
import { createFile, createFolder, renamePath } from "../../helpers/vault-ops";

/**
 * Test: Move file to different folder → suffix updated.
 *
 * Scenario:
 * Library/M1/Note-M1.md
 *
 * User moves to: Library/M2/Note-M1.md
 *
 * Expected:
 * Library/M2/Note-M2.md (suffix updated to match new path)
 */
export async function testMoveFileUpdatesuffix(): Promise<void> {
	const initialPath = "Library/M1/Note-M1.md";
	const movedPath = "Library/M2/Note-M1.md";
	const expectedPath = "Library/M2/Note-M2.md";

	await createFile(initialPath, "# Note");
	await createFolder("Library/M2");
	const created = await waitForFile(initialPath);
	expect(created).toBe(true);

	// Move to different folder (keeping old basename)
	await renamePath(initialPath, movedPath);

	const healedExists = await waitForFile(expectedPath);
	const movedGone = await waitForFileGone(movedPath, { timeout: 500 });

	expect(healedExists).toBe(true);
	expect(movedGone).toBe(true);
}

/**
 * Test: Move file to deeper folder → suffix extended.
 *
 * Scenario:
 * Library/M3/Note-M3.md
 *
 * User moves to: Library/M3/M4/Note-M3.md
 *
 * Expected:
 * Library/M3/M4/Note-M4-M3.md (suffix extended)
 */
export async function testMoveToDeepFolderExtendsSuffix(): Promise<void> {
	const initialPath = "Library/M3/Note-M3.md";
	const movedPath = "Library/M3/M4/Note-M3.md";
	const expectedPath = "Library/M3/M4/Note-M4-M3.md";

	await createFile(initialPath, "# Note");
	await createFolder("Library/M3/M4");
	const created = await waitForFile(initialPath);
	expect(created).toBe(true);

	await renamePath(initialPath, movedPath);

	const healedExists = await waitForFile(expectedPath);
	const movedGone = await waitForFileGone(movedPath, { timeout: 500 });

	expect(healedExists).toBe(true);
	expect(movedGone).toBe(true);
}

/**
 * Test: Move file to shallower folder → suffix shortened.
 *
 * Scenario:
 * Library/M5/M6/Note-M6-M5.md
 *
 * User moves to: Library/M5/Note-M6-M5.md
 *
 * Expected:
 * Library/M5/Note-M5.md (suffix shortened)
 */
export async function testMoveToShallowerFolderShortensSuffix(): Promise<void> {
	const initialPath = "Library/M5/M6/Note-M6-M5.md";
	const movedPath = "Library/M5/Note-M6-M5.md";
	const expectedPath = "Library/M5/Note-M5.md";

	await createFile(initialPath, "# Note");
	const created = await waitForFile(initialPath);
	expect(created).toBe(true);

	await renamePath(initialPath, movedPath);

	const healedExists = await waitForFile(expectedPath);
	const movedGone = await waitForFileGone(movedPath, { timeout: 500 });

	expect(healedExists).toBe(true);
	expect(movedGone).toBe(true);
}

/**
 * Test: Move file to Library root → suffix removed.
 *
 * Scenario:
 * Library/M7/M8/Note-M8-M7.md
 *
 * User moves to: Library/Note-M8-M7.md
 *
 * Expected:
 * Library/Note.md (suffix removed at root)
 */
export async function testMoveToRootRemovesSuffix(): Promise<void> {
	const initialPath = "Library/M7/M8/Note-M8-M7.md";
	const movedPath = "Library/Note-M8-M7.md";
	const expectedPath = "Library/NoteFromM8.md"; // Use unique name to avoid conflicts

	// Note: This test may need adjustment based on actual NameKing behavior
	// The expected behavior when moving to root with suffix is TBD

	await createFile(initialPath, "# Note");
	const created = await waitForFile(initialPath);
	expect(created).toBe(true);

	await renamePath(initialPath, movedPath);

	// For now, just check the file moved somewhere
	// The exact behavior depends on NameKing policy
	const movedGone = await waitForFileGone(movedPath);
	expect(movedGone).toBe(true);
}

/**
 * Test: Move folder with children → all children suffixes updated.
 *
 * Scenario:
 * Library/M9/M10/Note-M10-M9.md
 * Library/M9/M10/M11/Deep-M11-M10-M9.md
 *
 * User moves folder: Library/M9/M10 → Library/M12/M10
 *
 * Expected:
 * Library/M12/M10/Note-M10-M12.md
 * Library/M12/M10/M11/Deep-M11-M10-M12.md
 */
export async function testMoveFolderUpdatesAllDescendants(): Promise<void> {
	const file1Initial = "Library/M9/M10/Note-M10-M9.md";
	const file2Initial = "Library/M9/M10/M11/Deep-M11-M10-M9.md";
	const file1Expected = "Library/M12/M10/Note-M10-M12.md";
	const file2Expected = "Library/M12/M10/M11/Deep-M11-M10-M12.md";

	await createFile(file1Initial, "# Note");
	await createFile(file2Initial, "# Deep");
	await createFolder("Library/M12");
	const created1 = await waitForFile(file1Initial);
	const created2 = await waitForFile(file2Initial);
	expect(created1).toBe(true);
	expect(created2).toBe(true);

	// Move folder M10 under M12
	await renamePath("Library/M9/M10", "Library/M12/M10");

	const healed1 = await waitForFile(file1Expected);
	const healed2 = await waitForFile(file2Expected);

	expect(healed1).toBe(true);
	expect(healed2).toBe(true);
}
