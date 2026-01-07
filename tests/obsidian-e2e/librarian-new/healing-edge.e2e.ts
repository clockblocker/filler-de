/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import {
	testCoreNameWithDelimiter,
	testCreateInNonExistentFolders,
	testDeleteFileNoHealing,
	testDeleteFolderWithChildren,
	testEmptyFolderPruned,
	testFolderNameWithDelimiter,
	testFolderRenameMultipleFiles,
	testRapidSuccessiveRenames,
	testSuffixWithUnderscores,
} from "./healing/edge-cases.test";

const VAULT_PATH = "tests/obsidian-e2e/vaults/healing";

describe("Healing - Edge Cases", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await new Promise((r) => setTimeout(r, 7000));
	});

	it("coreName with delimiter works", testCoreNameWithDelimiter);
	it("empty folder is pruned", testEmptyFolderPruned);
	it("folder rename with multiple files", testFolderRenameMultipleFiles);
	it("suffix with underscores works", testSuffixWithUnderscores);
	it("rapid successive renames", testRapidSuccessiveRenames);
	it("create in non-existent folders", testCreateInNonExistentFolders);
	it("folder name with delimiter", testFolderNameWithDelimiter);
	it("delete file no healing", testDeleteFileNoHealing);
	it("delete folder with children", testDeleteFolderWithChildren);
});

