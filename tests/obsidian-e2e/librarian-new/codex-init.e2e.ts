/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { EXTRA_INIT_HEALING_WAIT_MS, INIT_HEALING_WAIT_MS } from "../helpers/polling";
import {
	testCodexCreatedOnInit,
	testCodexNamingDeeplyNested,
} from "./codex/codex-init.test";

const VAULT_PATH = "tests/obsidian-e2e/vaults/healing";

describe("Codex - Init", () => {
	before(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await new Promise((r) => setTimeout(r, INIT_HEALING_WAIT_MS + EXTRA_INIT_HEALING_WAIT_MS));
	});

	it("creates codex files on init", testCodexCreatedOnInit);
	it("codex naming for deeply nested sections", testCodexNamingDeeplyNested);
});
