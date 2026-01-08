/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { INIT_HEALING_WAIT_MS } from "../helpers/polling";
import {
	testDeepFolderRenameHealsAllDescendants,
	testFolderRenameHealsChildSuffix,
	testFolderRenameWithSuffixTriggersMove,
	testMiddleFolderRenameHealsDescendants,
	testNestedFolderRenameWithSuffixTriggersMove,
} from "./healing/folder-rename.test";

const VAULT_PATH = "tests/obsidian-e2e/vaults/healing";

describe("Healing - Folder Rename", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await new Promise((r) => setTimeout(r, INIT_HEALING_WAIT_MS));
	});

	// Deprecared untill Codexes are tested
	// it("heals child suffix when folder renamed", testFolderRenameHealsChildSuffix);
	// it("heals all descendants on deep folder rename", testDeepFolderRenameHealsAllDescendants);
	// it("heals descendants on middle folder rename", testMiddleFolderRenameHealsDescendants);
	// it("folder rename with suffix triggers move", testFolderRenameWithSuffixTriggersMove);
	// it("nested folder rename with suffix triggers move", testNestedFolderRenameWithSuffixTriggersMove);
});

