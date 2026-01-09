/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { INIT_HEALING_WAIT_MS } from "../helpers/polling";
import {
	testRemoveSuffixMovesToRoot,
	testRenameCoreNameNoHealing,
	testRenameRootFileStaysAtRoot,
	testRenameRootFileWithSuffixMoves,
	testRenameSuffixTriggersMove,
} from "./healing/file-rename.test";

const VAULT_PATH = "tests/obsidian-e2e/vaults/healing";

describe("Healing - File Rename", () => {
	before(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await new Promise((r) => setTimeout(r, INIT_HEALING_WAIT_MS));
	});

	// it("rename with new suffix triggers move", testRenameSuffixTriggersMove);
	// it("rename coreName only is no-op", testRenameCoreNameNoHealing);
	// it("rename root file stays at root", testRenameRootFileStaysAtRoot);
	// it("rename root file with suffix moves", testRenameRootFileWithSuffixMoves);
	// it("remove suffix moves to root", testRemoveSuffixMovesToRoot);
});

