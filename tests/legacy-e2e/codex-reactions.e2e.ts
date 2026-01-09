/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { EXTRA_INIT_HEALING_WAIT_MS, INIT_HEALING_WAIT_MS } from "../obsidian-e2e/helpers/polling";
import {
	testCodexRenamedOnFolderRename,
	testCodexRenamedOnNestedFolderRename,
	testCodexUpdatesOnFileMove,
	testCodexUpdatesOnFileRename,
	testCodexUpdatesOnFileRenameWithMove,
	testCodexUpdatesOnFolderMove,
} from "../obsidian-e2e/librarian/codex/codex-reactions.test";

const VAULT_PATH = "tests/obsidian-e2e/vaults/healing";

describe("Codex Reactions", () => {
	before(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		// Extra wait for codex creation (10 seconds total)
		await new Promise((r) => setTimeout(r, INIT_HEALING_WAIT_MS + EXTRA_INIT_HEALING_WAIT_MS + 4000));

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
	});

	// it("updates codex content on file rename", testCodexUpdatesOnFileRename);
	// it("updates codexes on file rename with move", testCodexUpdatesOnFileRenameWithMove);
	// it("renames codex on folder rename", testCodexRenamedOnFolderRename);
	// it("renames all descendant codexes on nested folder rename", testCodexRenamedOnNestedFolderRename);
	// it("updates codexes on file move", testCodexUpdatesOnFileMove);
	// it("updates codexes on folder move", testCodexUpdatesOnFolderMove);
});
