/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import { ASCHENPUTTEL_CONTENT } from "../../../../unit/librarian/bookkeeper/testcases/aschenputtel";
import { EXTRA_E2_FULL_CONTENT } from "../../../../unit/librarian/bookkeeper/testcases/extra-e2";
import { waitForIdle } from "../../../support/api/idle";
import { clickButton, createFile, openFile, renamePath } from "../../../support/api/vault-ops";

// Suffix delimiter (matches default settings: "-")
const D = "-";

/**
 * Setup: Create scroll file and move to Library.
 * 1. Create Aschenputtel-Märchen.md in vault root
 * 2. Move to Library → triggers healing to Library/Märchen/Aschenputtel-Märchen.md
 */
export async function performSetup(): Promise<void> {
	// 1. Create file in root with suffix format (Aschenputtel-Märchen = coreName-suffix)
	const createResult = await createFile("Aschenputtel-Märchen.md", ASCHENPUTTEL_CONTENT);
	if (createResult.isErr()) {
		throw new Error(`Failed to create file: ${createResult.error}`);
	}
	await waitForIdle();

	// 2. Move to Library → librarian heals to Library/Märchen/Aschenputtel ;; Märchen.md
	const renameResult = await renamePath("Aschenputtel-Märchen.md", "Library/Aschenputtel-Märchen.md");
	if (renameResult.isErr()) {
		throw new Error(`Failed to rename file: ${renameResult.error}`);
	}
	await waitForIdle();
}

/**
 * Click "Make this a text" button.
 * 1. Open the healed scroll file
 * 2. Click the MakeText button
 */
export async function performMakeText(): Promise<void> {
	// 1. Open the healed file path
	const filePath = `Library/Märchen/Aschenputtel${D}Märchen.md`;
	const openResult = await openFile(filePath);
	if (openResult.isErr()) {
		throw new Error(`Failed to open file: ${openResult.error}`);
	}
	await waitForIdle();

	// 2. Click "Make this a text" button
	const clickResult = await clickButton("MakeText");
	if (clickResult.isErr()) {
		throw new Error(`Failed to click button: ${clickResult.error}`);
	}
	await waitForIdle();
}

/**
 * Setup for EXTRA_E2: Create scroll file with dialogue content and move to Library.
 * 1. Create ExtraE2-Dialog.md in vault root
 * 2. Move to Library → triggers healing to Library/Dialog/ExtraE2-Dialog.md
 */
export async function performSetupExtraE2(): Promise<void> {
	// 1. Create file in root with suffix format (ExtraE2-Dialog = coreName-suffix)
	const createResult = await createFile("ExtraE2-Dialog.md", EXTRA_E2_FULL_CONTENT);
	if (createResult.isErr()) {
		throw new Error(`Failed to create file: ${createResult.error}`);
	}
	await waitForIdle();

	// 2. Move to Library → librarian heals to Library/Dialog/ExtraE2-Dialog.md
	const renameResult = await renamePath("ExtraE2-Dialog.md", "Library/ExtraE2-Dialog.md");
	if (renameResult.isErr()) {
		throw new Error(`Failed to rename file: ${renameResult.error}`);
	}
	await waitForIdle();
}

/**
 * Click "Make this a text" button for EXTRA_E2.
 * 1. Open the healed scroll file
 * 2. Click the MakeText button
 */
export async function performMakeTextExtraE2(): Promise<void> {
	// 1. Open the healed file path
	const filePath = `Library/Dialog/ExtraE2${D}Dialog.md`;
	const openResult = await openFile(filePath);
	if (openResult.isErr()) {
		throw new Error(`Failed to open file: ${openResult.error}`);
	}
	await waitForIdle();

	// 2. Click "Make this a text" button
	const clickResult = await clickButton("MakeText");
	if (clickResult.isErr()) {
		throw new Error(`Failed to click button: ${clickResult.error}`);
	}
	await waitForIdle();
}

/**
 * Test navigation buttons on a Page file.
 * Verifies that clicking NavigatePage button navigates to next page.
 */
export async function testNavigationButtons(): Promise<void> {
	// Open the Page file created after MakeText
	const pagePath = `Library/Märchen/Aschenputtel/Aschenputtel_Page_000${D}Aschenputtel${D}Märchen.md`;
	const openResult = await openFile(pagePath);
	if (openResult.isErr()) {
		throw new Error(`Failed to open Page file: ${openResult.error}`);
	}
	await waitForIdle();

	// Get current file before click
	const fileBefore = await browser.executeObsidian(async ({ app }) => {
		const file = app.workspace.getActiveFile();
		return file?.path ?? "none";
	});

	// Click NavigatePage (next) button
	const nextResult = await clickButton("NavigatePage");
	if (nextResult.isErr()) {
		throw new Error(`Failed to click NavigatePage: ${nextResult.error}`);
	}

	// Wait for navigation
	await waitForIdle();

	// Get current file after click
	const fileAfter = await browser.executeObsidian(async ({ app }) => {
		const file = app.workspace.getActiveFile();
		return file?.path ?? "none";
	});

	// Verify navigation occurred
	if (fileBefore === fileAfter) {
		throw new Error(
			`Navigation did not work. File before: ${fileBefore}, after: ${fileAfter}`,
		);
	}

	// Verify we're on Page_001
	if (!fileAfter.includes("Page_001")) {
		throw new Error(`Expected to navigate to Page_001, but got: ${fileAfter}`);
	}
}
