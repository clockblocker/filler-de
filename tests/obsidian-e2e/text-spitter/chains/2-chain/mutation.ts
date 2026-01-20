/// <reference types="@wdio/globals/types" />
import { ASCHENPUTTEL_CONTENT } from "../../../../unit/librarian/bookkeeper/testcases/aschenputtel";
import { clickButton, createFile, openFile, renamePath } from "../../../support/api/vault-ops";
import { waitForIdle } from "../../../support/api/idle";

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
