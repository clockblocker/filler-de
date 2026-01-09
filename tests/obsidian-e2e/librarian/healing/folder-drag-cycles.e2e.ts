/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { EXTRA_INIT_HEALING_WAIT_MS, INIT_HEALING_WAIT_MS } from "../../helpers/polling";
import { testFolderDragCycles } from "./folder-drag-cycles.test";

const VAULT_PATH = "tests/obsidian-e2e/vaults/folder-drag-cycles";

describe("Healing - Folder Drag Cycles", () => {
	before(async () => {
		console.log("[Folder Drag Cycles] Resetting vault...");
		await obsidianPage.resetVault(VAULT_PATH);
		console.log("[Folder Drag Cycles] Waiting for init healing...");
		await new Promise((r) => setTimeout(r, INIT_HEALING_WAIT_MS + EXTRA_INIT_HEALING_WAIT_MS));
		console.log("[Folder Drag Cycles] Init complete");
	});

	it("maintains correct suffixes after multiple drag cycles", testFolderDragCycles);
});
