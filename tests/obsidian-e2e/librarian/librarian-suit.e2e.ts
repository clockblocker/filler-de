/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { EXTRA_INIT_HEALING_WAIT_MS, INIT_HEALING_WAIT_MS } from "../helpers/polling";
import {
	testAllCodexesCreatedOnInit,
} from "./codex/codex-init.test";

const VAULT_PATH = "tests/obsidian-e2e/vaults/librarian-for-e2e";

describe("Librarian Full Suit", () => {
	before(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await new Promise((r) => setTimeout(r, INIT_HEALING_WAIT_MS + EXTRA_INIT_HEALING_WAIT_MS));
	});

    // Codex Init
	it("creates all codex files on init", testAllCodexesCreatedOnInit);

    // Fs init
});
