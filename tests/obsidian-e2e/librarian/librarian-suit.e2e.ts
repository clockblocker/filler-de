/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { waitForIdle } from "../support/api/idle";
import {
	testAllCodexesCreatedOnInit,
    testAllFilesSuffixedOnInit,
} from "./chains/0-chain/000-init";
import {
	performMutation001,
	testPostHealing001,
} from "./chains/0-chain/001-create-more-files";

const VAULT_PATH = "tests/obsidian-e2e/vaults/librarian-chain-0";

describe("Librarian Full Suit", () => {
	before(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await waitForIdle();
	});

    // Codex Are generated
	it("creates all codex files on init", testAllCodexesCreatedOnInit);

    // Files are canonically suffixed
	it("all files are healed to canonical suffixes on init", testAllFilesSuffixedOnInit);

	// Create more files mutation
	it("creates additional files after mutation", async () => {
		await performMutation001();
		await waitForIdle();
	});

	// Post-mutation healing
	it("heals all files to canonical suffixes after mutation", async () => {
		await testPostHealing001();
	});

	// after(async () => {
	// 	// Indefinite waiter to keep Obsidian window open for manual inspection
	// 	await new Promise(() => {});
	// });
});

