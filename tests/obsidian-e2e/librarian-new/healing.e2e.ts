/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
// Edge cases
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
// File create tests
import {
	testFileWithCorrectSuffixNoOp,
	testFileWithWrongSuffixHealed,
	testNestedFileGetsSuffix,
	testRootFileNoSuffix,
} from "./healing/file-create.test";
// File move tests
import {
	testMoveFileUpdatesuffix,
	testMoveFolderUpdatesAllDescendants,
	testMoveToDeepFolderExtendsSuffix,
	testMoveToRootRemovesSuffix,
	testMoveToShallowerFolderShortensSuffix,
} from "./healing/file-move.test";
// File rename tests
import {
	testRemoveSuffixMovesToRoot,
	testRenameCoreNameNoHealing,
	testRenameRootFileStaysAtRoot,
	testRenameRootFileWithSuffixMoves,
	testRenameSuffixTriggersMove,
} from "./healing/file-rename.test";
// Folder rename tests
import {
	testDeepFolderRenameHealsAllDescendants,
	testFolderRenameHealsChildSuffix,
	testFolderRenameWithSuffixTriggersMove,
	testMiddleFolderRenameHealsDescendants,
	testNestedFolderRenameWithSuffixTriggersMove,
} from "./healing/folder-rename.test";
// Init healing tests
import {
	testInitHealingAddsSuffixToNestedFile,
	testInitHealingFixesWrongSuffix,
	testInitHealingMovesRootFileWithSuffix,
	testInitHealingMultipleFiles,
	testInitHealingNoOpForCorrectFiles,
	testInitHealingRootFileNoSuffix,
} from "./healing/init-healing.test";

const VAULT_PATH = "tests/obsidian-e2e/vaults/healing";

describe("Librarian New - Healing", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		// Wait for plugin init
		await new Promise((r) => setTimeout(r, 500));
	});

	// ─── Init Healing ───

	describe("Init Healing", () => {
		it("fixes files with wrong suffix on load", testInitHealingFixesWrongSuffix);
		it("no-op for files with correct suffix", testInitHealingNoOpForCorrectFiles);
		it("moves root file with suffix to suffix location", testInitHealingMovesRootFileWithSuffix);
		it("adds suffix to nested file without one", testInitHealingAddsSuffixToNestedFile);
		it("root file stays without suffix", testInitHealingRootFileNoSuffix);
		it("processes multiple files", testInitHealingMultipleFiles);
	});

	// ─── Folder Rename ───

	describe("Folder Rename", () => {
		it("heals child suffix when folder renamed", testFolderRenameHealsChildSuffix);
		it("heals all descendants on deep folder rename", testDeepFolderRenameHealsAllDescendants);
		it("heals descendants on middle folder rename", testMiddleFolderRenameHealsDescendants);
		it("folder rename with suffix triggers move", testFolderRenameWithSuffixTriggersMove);
		it("nested folder rename with suffix triggers move", testNestedFolderRenameWithSuffixTriggersMove);
	});

	// ─── File Create ───

	describe("File Create", () => {
		it("root file gets no suffix", testRootFileNoSuffix);
		it("nested file gets suffix added", testNestedFileGetsSuffix);
		it("file with correct suffix is no-op", testFileWithCorrectSuffixNoOp);
		it("file with wrong suffix is healed", testFileWithWrongSuffixHealed);
	});

	// ─── File Rename ───

	describe("File Rename", () => {
		it("rename with new suffix triggers move", testRenameSuffixTriggersMove);
		it("rename coreName only is no-op", testRenameCoreNameNoHealing);
		it("rename root file stays at root", testRenameRootFileStaysAtRoot);
		it("rename root file with suffix moves", testRenameRootFileWithSuffixMoves);
		it("remove suffix moves to root", testRemoveSuffixMovesToRoot);
	});

	// ─── File Move ───

	describe("File Move", () => {
		it("move file updates suffix", testMoveFileUpdatesuffix);
		it("move to deeper folder extends suffix", testMoveToDeepFolderExtendsSuffix);
		it("move to shallower folder shortens suffix", testMoveToShallowerFolderShortensSuffix);
		it("move to root removes suffix", testMoveToRootRemovesSuffix);
		it("move folder updates all descendants", testMoveFolderUpdatesAllDescendants);
	});

	// ─── Edge Cases ───

	describe("Edge Cases", () => {
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
});
