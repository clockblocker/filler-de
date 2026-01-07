/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import { waitForFile, waitForFileGone } from "../helpers/polling";

const VAULT_PATH = "tests/obsidian-e2e/vaults/folder-rename-healing";

const INITIAL_PATH =
	"Library/grandpa/father/kid/Diary-kid-father-grandpa-Test_new_librarian.md";
const EXPECTED_PATH =
	"Library/grandpa/father/son/Diary-son-father-grandpa-Test_new_librarian.md";
const WRONG_SUFFIX_PATH =
	"Library/grandpa/father/son/Diary-kid-father-grandpa-Test_new_librarian.md";

/**
 * Test: Renaming a folder heals nested leaf suffixes.
 *
 * Scenario:
 * Library/grandpa/father/kid/Diary-kid-father-grandpa-Test_new_librarian.md
 *
 * User renames: kid → son
 *
 * Expected:
 * Library/grandpa/father/son/Diary-son-father-grandpa-Test_new_librarian.md
 */
describe("Librarian New - Folder Rename Healing", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		// Wait for plugin init
		await new Promise((r) => setTimeout(r, 500));
	});

	it("should heal nested leaf suffix when parent folder renamed", async () => {
		// Verify initial file exists
		const initialExists = await waitForFile(INITIAL_PATH);
		expect(initialExists).toBe(true);

		// Rename folder: kid → son
		await browser.executeObsidian(async ({ app }) => {
			const kidFolder = app.vault.getAbstractFileByPath(
				"Library/grandpa/father/kid",
			);
			if (!kidFolder) throw new Error("kid folder not found");
			await app.vault.rename(kidFolder, "Library/grandpa/father/son");
		});

		// Poll for healed file
		const healedExists = await waitForFile(EXPECTED_PATH, { timeout: 3000 });
		const wrongGone = await waitForFileGone(WRONG_SUFFIX_PATH, { timeout: 500 });

		expect(healedExists).toBe(true);
		expect(wrongGone).toBe(true);
	});
});

