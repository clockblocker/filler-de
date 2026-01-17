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
import {
	performMutation002,
	testPostHealing002,
} from "./chains/0-chain/002-rename-files";
import {
	performMutation003,
	testPostHealing003,
} from "./chains/0-chain/003-create-and-rename-a-file";
import {
	performMutation004,
	testPostHealing004,
} from "./chains/1-chain/004-delete-file";
import {
	performMutation005,
	testPostHealing005,
} from "./chains/1-chain/005-delete-folder";
import {
	performMutation006,
	testPostHealing006,
} from "./chains/1-chain/006-rename-corename";

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

	// 002: Rename files mutation
	it("renames folders for 002", async () => {
		await performMutation002();
		await waitForIdle();
	});

	// 002: Post-rename healing logging
	it("logs vault state after rename healing", async () => {
		await testPostHealing002();
	});

	// 003: Create and rename a file mutation
	it("creates and renames a file for 003", async () => {
		await performMutation003();
		await waitForIdle();
	});

	// 003: Post create-and-rename healing - BUG: codex should update to new name
	it("codex should reflect renamed file", async () => {
		await testPostHealing003();
	});

	// 004: Delete file mutation
	it("deletes file for 004", async () => {
		await performMutation004();
		await waitForIdle();
	});

	// 004: Post-deletion healing
	it("codex no longer refs deleted file", async () => {
		await testPostHealing004();
	});

	// 005: Delete folder mutation
	it("deletes folder for 005", async () => {
		await performMutation005();
		await waitForIdle();
	});

	// 005: Post-deletion healing
	it("codexes no longer ref deleted folder", async () => {
		await testPostHealing005();
	});

	// 006: Rename coreName (keep suffix) mutation
	it("creates and renames coreName for 006", async () => {
		await performMutation006();
		await waitForIdle();
	});

	// 006: Post-rename healing - BUG: codex should update display name
	it("codex should show new coreName after rename", async () => {
		await testPostHealing006();
	});

	// after(async () => {
	// 	// Indefinite waiter to keep Obsidian window open for manual inspection
	// 	await new Promise(() => {});
	// });
});

