/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { EXTRA_INIT_HEALING_WAIT_MS, INIT_HEALING_WAIT_MS } from "../helpers/polling";
import {
	testCodexUpdatesOnFileRename,
	testCodexUpdatesOnFileRenameWithMove,
	testCodexRenamedOnFolderRename,
	testCodexRenamedOnNestedFolderRename,
	testCodexUpdatesOnFileMove,
	testCodexUpdatesOnFolderMove,
} from "./codex/codex-reactions.test";

const VAULT_PATH = "tests/obsidian-e2e/vaults/healing";

describe("Codex - File Rename", () => {
	before(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await new Promise((r) => setTimeout(r, INIT_HEALING_WAIT_MS + EXTRA_INIT_HEALING_WAIT_MS));
	});

	it("updates codex content on file rename", testCodexUpdatesOnFileRename);
	it("updates codexes on file rename with move", testCodexUpdatesOnFileRenameWithMove);
});

describe("Codex - Folder Rename", () => {
	before(async () => {
		console.log("[Folder Rename] Resetting vault...");
		await obsidianPage.resetVault(VAULT_PATH);
		console.log("[Folder Rename] Waiting for init...");
		// Extra wait for codex creation (10 seconds total)
		await new Promise((r) => setTimeout(r, INIT_HEALING_WAIT_MS + EXTRA_INIT_HEALING_WAIT_MS + 4000));
		console.log("[Folder Rename] Init complete");
		
		// Debug: list all files in Library
		const allFiles = await browser.executeObsidian(async ({ app }) => {
			const result: string[] = [];
			const recurse = (path: string) => {
				const folder = app.vault.getAbstractFileByPath(path);
				if (!folder || !("children" in folder)) return;
				for (const child of (folder as any).children) {
					result.push(child.path);
					if ("children" in child) recurse(child.path);
				}
			};
			recurse("Library");
			return result;
		});
		console.log("[Folder Rename] All files in Library after init:", allFiles);
	});

	it("renames codex on folder rename", testCodexRenamedOnFolderRename);
	it("renames all descendant codexes on nested folder rename", testCodexRenamedOnNestedFolderRename);
});

describe("Codex - File Move", () => {
	before(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await new Promise((r) => setTimeout(r, INIT_HEALING_WAIT_MS + EXTRA_INIT_HEALING_WAIT_MS));
	});

	it("updates codexes on file move", testCodexUpdatesOnFileMove);
});

describe("Codex - Folder Move", () => {
	before(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await new Promise((r) => setTimeout(r, INIT_HEALING_WAIT_MS + EXTRA_INIT_HEALING_WAIT_MS));
	});

	it("updates codexes on folder move", testCodexUpdatesOnFolderMove);
});
