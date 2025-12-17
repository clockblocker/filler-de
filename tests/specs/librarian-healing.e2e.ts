/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
	testDragInFileNoSuffixStaysAtRoot,
	testMoveOutOfLibraryIgnored,
} from "./librarian-healing/drag-in-healing.test";
import {
	testInitHealing,
	testInitHealingNoOpForCorrectFiles,
} from "./librarian-healing/init-healing.test";
import {
	testRuntimeFolderRename,
	testRuntimeNoOpWhenCorrect,
	testRuntimePathOnly,
} from "./librarian-healing/runtime-healing.test";
import { VAULT_PATH } from "./librarian-healing/utils";

describe("Librarian Healing", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await browser.executeObsidian(async ({ app }) => {
			await (app as any).commands.executeCommandById(
				"textfresser-testing-expose-opened-service",
			);
		});
	});

	describe("Mode 1: Runtime Healing", () => {
		// TODO: BasenameOnly test needs folder creation - complex integration
		// it("BasenameOnly: should move file to suffix location", testRuntimeBasenameOnly);
		it("PathOnly: should fix suffix to match new path", testRuntimePathOnly);
		it("PathOnly: generates action when suffix needs fix", testRuntimeNoOpWhenCorrect);
		it("Folder rename: should heal all children suffixes", testRuntimeFolderRename);
	});

	describe("Mode 2: Init Healing", () => {
		it("should heal files with wrong suffixes on init", testInitHealing);
		it(
			"should not rename files with correct suffixes",
			testInitHealingNoOpForCorrectFiles,
		);
	});

	describe("Mode 3: DragIn Healing", () => {
		// TODO: File drag with folder creation - complex integration
		// it("File drag: should move to suffix location", testDragInFileMoveToSuffix);
		it(
			"File without suffix: should stay at drop location",
			testDragInFileNoSuffixStaysAtRoot,
		);
		it(
			"Move out of library: should be ignored",
			testMoveOutOfLibraryIgnored,
		);
	});
});
