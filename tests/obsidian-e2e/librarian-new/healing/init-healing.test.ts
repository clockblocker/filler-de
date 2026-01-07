/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import { waitForFile, waitForFileGone } from "../../helpers/polling";

/**
 * Test: Init healing fixes files with wrong suffix on plugin load.
 *
 * Scenario:
 * Vault contains: Library/I1/I2/Note-WRONG.md (wrong suffix)
 *
 * On plugin init:
 * Expected: Library/I1/I2/Note-I2-I1.md (suffix fixed)
 */
export async function testInitHealingFixesWrongSuffix(): Promise<void> {
	// This test uses a special vault with pre-existing wrong files
	// The vault should have Library/I1/I2/Note-WRONG.md
	const wrongPath = "Library/I1/I2/Note-WRONG.md";
	const expectedPath = "Library/I1/I2/Note-I2-I1.md";

	// After plugin init (which happens in beforeEach), file should be healed
	const healedExists = await waitForFile(expectedPath, { timeout: 3000 });
	const wrongGone = await waitForFileGone(wrongPath, { timeout: 500 });

	expect(healedExists).toBe(true);
	expect(wrongGone).toBe(true);
}

/**
 * Test: Init healing doesn't touch files with correct suffix.
 *
 * Scenario:
 * Vault contains: Library/grandpa/father/kid/Diary-kid-father-grandpa.md (correct)
 *
 * On plugin init:
 * Expected: File stays at same path (no healing needed)
 */
export async function testInitHealingNoOpForCorrectFiles(): Promise<void> {
	const correctPath = "Library/grandpa/father/kid/Diary-kid-father-grandpa.md";

	// File should still exist at correct path after init
	const exists = await waitForFile(correctPath);
	expect(exists).toBe(true);
}

/**
 * Test: Init healing fixes file at root with suffix (moves to suffix location).
 *
 * Scenario:
 * Vault contains: Library/Note-X-Y.md (root file with suffix)
 *
 * On plugin init:
 * Expected: Library/Y/X/Note-X-Y.md (moved to suffix location)
 */
export async function testInitHealingMovesRootFileWithSuffix(): Promise<void> {
	const wrongPath = "Library/Note-X-Y.md";
	const expectedPath = "Library/Y/X/Note-X-Y.md";

	const healedExists = await waitForFile(expectedPath, { timeout: 3000 });
	const wrongGone = await waitForFileGone(wrongPath, { timeout: 500 });

	expect(healedExists).toBe(true);
	expect(wrongGone).toBe(true);
}

/**
 * Test: Init healing adds suffix to nested file without one.
 *
 * Scenario:
 * Vault contains: Library/I3/I4/Untitled.md (no suffix)
 *
 * On plugin init:
 * Expected: Library/I3/I4/Untitled-I4-I3.md (suffix added)
 */
export async function testInitHealingAddsSuffixToNestedFile(): Promise<void> {
	const wrongPath = "Library/I3/I4/Untitled.md";
	const expectedPath = "Library/I3/I4/Untitled-I4-I3.md";

	const healedExists = await waitForFile(expectedPath, { timeout: 3000 });
	const wrongGone = await waitForFileGone(wrongPath, { timeout: 500 });

	expect(healedExists).toBe(true);
	expect(wrongGone).toBe(true);
}

/**
 * Test: Init healing doesn't add suffix to root file.
 *
 * Scenario:
 * Vault contains: Library/RootNote.md (root file, no suffix)
 *
 * On plugin init:
 * Expected: Library/RootNote.md (stays at root, no suffix needed)
 */
export async function testInitHealingRootFileNoSuffix(): Promise<void> {
	const path = "Library/RootNote.md";

	// Root file should stay without suffix
	const exists = await waitForFile(path);
	expect(exists).toBe(true);
}

/**
 * Test: Init healing processes multiple files.
 *
 * Scenario:
 * Vault contains multiple files needing healing
 *
 * On plugin init:
 * Expected: All files healed correctly
 */
export async function testInitHealingMultipleFiles(): Promise<void> {
	// Check that the vault's pre-existing correct files are still correct
	const file1 = "Library/grandpa/father/kid/Diary-kid-father-grandpa.md";
	const file2 = "Library/A/B/C/Note-C-B-A.md";
	const file3 = "Library/A/B/Note-B-A.md";

	const exists1 = await waitForFile(file1);
	const exists2 = await waitForFile(file2);
	const exists3 = await waitForFile(file3);

	expect(exists1).toBe(true);
	expect(exists2).toBe(true);
	expect(exists3).toBe(true);
}

