/// <reference types="@wdio/globals/types" />
import { expect } from "@wdio/globals";
import { OFFSET_AFTER_FILE_DELETION, waitForFile, waitForFileGone } from "../../helpers/polling";
import { createFile, createFolder, modifyFile, readFile, renamePath } from "../../support/api/vault-ops";

/**
 * Test: Scroll backlink healing preserves user content on move.
 *
 * Scenario:
 * 1. Create scroll Library/SB1/Note-SB1.md with user content
 * 2. Wait for healing (backlink added)
 * 3. Add more user content after backlink
 * 4. Move scroll to Library/SB2/Note-SB1.md
 * 5. Wait for healing (suffix updated, backlink updated)
 * 6. Verify user content preserved, backlink points to new parent
 */
export async function testScrollBacklinkPreservesContentOnMove(): Promise<void> {
	const initialPath = "Library/SB1/Note-SB1.md";
	const movedPath = "Library/SB2/Note-SB1.md";
	const expectedPath = "Library/SB2/Note-SB2.md";
	const userContent = "# My Note\n\nThis is user content that should be preserved.";

	// 1. Create scroll with user content
	await createFile(initialPath, userContent);
	await createFolder("Library/SB2");
	const created = await waitForFile(initialPath);
	expect(created).toBe(true);

	// 2. Wait a bit for healing to add backlink
	await new Promise((resolve) => setTimeout(resolve, 500));

	// 3. Read content and verify backlink was added
	const contentAfterHeal = await readFile(initialPath);
	expect(contentAfterHeal.isOk()).toBe(true);
	if (contentAfterHeal.isOk()) {
		// Should have backlink pointing to SB1's codex
		expect(contentAfterHeal.value).toContain("[[__-SB1|← SB1]]");
		expect(contentAfterHeal.value).toContain(userContent);
	}

	// 4. Add more user content
	const updatedContent = contentAfterHeal.isOk()
		? contentAfterHeal.value + "\n\nExtra content added by user."
		: userContent + "\n\nExtra content added by user.";
	await modifyFile(initialPath, updatedContent);

	// 5. Move to different folder
	await renamePath(initialPath, movedPath);

	// 6. Wait for healing
	const healedExists = await waitForFile(expectedPath);
	const movedGone = await waitForFileGone(movedPath, OFFSET_AFTER_FILE_DELETION);

	expect(healedExists).toBe(true);
	expect(movedGone).toBe(true);

	// 7. Verify content
	const finalContent = await readFile(expectedPath);
	expect(finalContent.isOk()).toBe(true);
	if (finalContent.isOk()) {
		// Backlink should now point to SB2's codex
		expect(finalContent.value).toContain("[[__-SB2|← SB2]]");
		// Old backlink should be gone
		expect(finalContent.value).not.toContain("[[__-SB1|← SB1]]");
		// User content should be preserved
		expect(finalContent.value).toContain("# My Note");
		expect(finalContent.value).toContain("This is user content that should be preserved.");
		expect(finalContent.value).toContain("Extra content added by user.");
	}
}

/**
 * Test: Scroll backlink added on creation.
 *
 * Scenario:
 * 1. Create scroll Library/SB3/Fresh-SB3.md
 * 2. Wait for healing
 * 3. Verify backlink was added pointing to parent codex
 */
export async function testScrollBacklinkAddedOnCreation(): Promise<void> {
	const scrollPath = "Library/SB3/Fresh-SB3.md";
	const userContent = "# Fresh Note\n\nJust created.";

	await createFile(scrollPath, userContent);
	const created = await waitForFile(scrollPath);
	expect(created).toBe(true);

	// Wait for healing
	await new Promise((resolve) => setTimeout(resolve, 500));

	const content = await readFile(scrollPath);
	expect(content.isOk()).toBe(true);
	if (content.isOk()) {
		// Should have backlink at start (after initial newline)
		expect(content.value).toContain("[[__-SB3|← SB3]]");
		// User content preserved
		expect(content.value).toContain("# Fresh Note");
		expect(content.value).toContain("Just created.");
	}
}

/**
 * Test: Scroll in nested folder has correct backlink.
 *
 * Scenario:
 * 1. Create scroll Library/SB4/SB5/Deep-SB5-SB4.md
 * 2. Wait for healing
 * 3. Verify backlink points to immediate parent (SB5)
 */
export async function testScrollBacklinkPointsToImmediateParent(): Promise<void> {
	const scrollPath = "Library/SB4/SB5/Deep-SB5-SB4.md";
	const userContent = "# Deep Note";

	await createFile(scrollPath, userContent);
	const created = await waitForFile(scrollPath);
	expect(created).toBe(true);

	// Wait for healing
	await new Promise((resolve) => setTimeout(resolve, 500));

	const content = await readFile(scrollPath);
	expect(content.isOk()).toBe(true);
	if (content.isOk()) {
		// Backlink should point to SB5 (immediate parent), not SB4
		expect(content.value).toContain("[[__-SB5-SB4|← SB5]]");
		expect(content.value).toContain("# Deep Note");
	}
}
