/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import {
	testAllCodexesCreatedOnInit,
    testAllFilesSuffixedOnInit,
} from "./chains/0-chain/000-init";

const VAULT_PATH = "tests/obsidian-e2e/vaults/librarian-chain-0";

describe("Librarian Full Suit", () => {
	before(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
	});

    // Codex Are generated
	it("creates all codex files on init", testAllCodexesCreatedOnInit);

    // Files are canonically suffixed
	it("all files are healed to canonical suffixes on init", testAllFilesSuffixedOnInit);
});
