/// <reference types="@wdio/globals/types" />
import { expect } from "@wdio/globals";
import { waitForFile, waitForFileGone } from "../../helpers/polling";
import { createFile, renamePath } from "../../helpers/vault-ops";

/**
 * Test: Rename file with suffix indicating move → file moves to suffix location.
 *
 * Scenario:
 * Library/R1/S1/T1/Untitled-T1-S1-R1.md
 *
 * User renames to: diary-tom-T1-S1-R1.md
 * (suffix now includes "tom" which doesn't exist)
 *
 * Expected:
 * Library/R1/S1/T1/tom/diary-tom-T1-S1-R1.md
 * (folder "tom" auto-created, file moved there)
 */
export async function testRenameSuffixTriggersMove(): Promise<void> {
	const initialPath = "Library/R1/S1/T1/Untitled-T1-S1-R1.md";
	const renamedPath = "Library/R1/S1/T1/diary-tom-T1-S1-R1.md";
	const expectedPath = "Library/R1/S1/T1/tom/diary-tom-T1-S1-R1.md";

	// Create initial file with correct suffix
	await createFile(initialPath, "# Note");
	const created = await waitForFile(initialPath);
	expect(created).toBe(true);

	// Rename with suffix indicating move to "tom" folder
	await renamePath(initialPath, renamedPath);

	// Should be moved to tom folder
	const movedExists = await waitForFile(expectedPath, { timeout: 3000 });
	const renamedGone = await waitForFileGone(renamedPath, { timeout: 500 });

	expect(movedExists).toBe(true);
	expect(renamedGone).toBe(true);
}

/**
 * Test: Rename coreName only (suffix unchanged) → no healing needed.
 *
 * Scenario:
 * Library/R2/S2/T2/diary-T2-S2-R2.md
 *
 * User renames to: homework-T2-S2-R2.md
 * (coreName changed, suffix unchanged)
 *
 * Expected:
 * Library/R2/S2/T2/homework-T2-S2-R2.md
 * (no move, just rename in place)
 */
export async function testRenameCoreNameNoHealing(): Promise<void> {
	const initialPath = "Library/R2/S2/T2/diary-T2-S2-R2.md";
	const expectedPath = "Library/R2/S2/T2/homework-T2-S2-R2.md";

	// Create initial file
	await createFile(initialPath, "# Diary");
	const created = await waitForFile(initialPath);
	expect(created).toBe(true);

	// Rename coreName only
	await renamePath(initialPath, expectedPath);

	// Wait a bit for any potential healing
	await new Promise((r) => setTimeout(r, 500));

	// Should stay at renamed path (no healing needed)
	const exists = await waitForFile(expectedPath);
	expect(exists).toBe(true);
}

/**
 * Test: Rename file at root (no suffix) → stays at root.
 *
 * Scenario:
 * Library/RootNote1.md
 *
 * User renames to: RootDiary1.md
 *
 * Expected:
 * Library/RootDiary1.md (no suffix, stays at root)
 */
export async function testRenameRootFileStaysAtRoot(): Promise<void> {
	const initialPath = "Library/RootNote1.md";
	const expectedPath = "Library/RootDiary1.md";

	await createFile(initialPath, "# Note");
	const created = await waitForFile(initialPath);
	expect(created).toBe(true);

	await renamePath(initialPath, expectedPath);

	// Wait a bit
	await new Promise((r) => setTimeout(r, 500));

	const exists = await waitForFile(expectedPath);
	expect(exists).toBe(true);
}

/**
 * Test: Rename root file with suffix → moves to suffix location.
 *
 * Scenario:
 * Library/RootNote2.md
 *
 * User renames to: RootNote2-P-Q.md
 * (adding suffix implies move to Library/Q/P/)
 *
 * Expected:
 * Library/Q/P/RootNote2-P-Q.md
 */
export async function testRenameRootFileWithSuffixMoves(): Promise<void> {
	const initialPath = "Library/RootNote2.md";
	const renamedPath = "Library/RootNote2-P-Q.md";
	const expectedPath = "Library/Q/P/RootNote2-P-Q.md";

	await createFile(initialPath, "# Note");
	const created = await waitForFile(initialPath);
	expect(created).toBe(true);

	await renamePath(initialPath, renamedPath);

	const movedExists = await waitForFile(expectedPath, { timeout: 3000 });
	const renamedGone = await waitForFileGone(renamedPath, { timeout: 500 });

	expect(movedExists).toBe(true);
	expect(renamedGone).toBe(true);
}

/**
 * Test: Remove suffix from nested file → moves to Library root.
 *
 * Scenario:
 * Library/R3/S3/Note-S3-R3.md
 *
 * User renames to: Note.md (removing suffix)
 *
 * Expected:
 * Library/Note.md (moved to root, no suffix)
 */
export async function testRemoveSuffixMovesToRoot(): Promise<void> {
	const initialPath = "Library/R3/S3/Note-S3-R3.md";
	const renamedPath = "Library/R3/S3/Note.md";
	const expectedPath = "Library/Note.md";

	await createFile(initialPath, "# Note");
	const created = await waitForFile(initialPath);
	expect(created).toBe(true);

	await renamePath(initialPath, renamedPath);

	const movedExists = await waitForFile(expectedPath, { timeout: 3000 });
	const renamedGone = await waitForFileGone(renamedPath, { timeout: 500 });

	expect(movedExists).toBe(true);
	expect(renamedGone).toBe(true);
}
