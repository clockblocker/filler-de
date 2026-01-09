/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { INIT_HEALING_WAIT_MS } from "../obsidian-e2e/helpers/polling";
import {
	testMoveFileUpdatesuffix,
	testMoveFolderUpdatesAllDescendants,
	testMoveToDeepFolderExtendsSuffix,
	testMoveToRootRemovesSuffix,
	testMoveToShallowerFolderShortensSuffix,
} from "../obsidian-e2e/librarian/healing-legacy/file-move.test";

const VAULT_PATH = "tests/obsidian-e2e/vaults/healing";

describe("Healing - File Move", () => {
	before(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await new Promise((r) => setTimeout(r, INIT_HEALING_WAIT_MS));
	});

	it("move file updates suffix", testMoveFileUpdatesuffix);
	it("move to deeper folder extends suffix", testMoveToDeepFolderExtendsSuffix);
	it("move to shallower folder shortens suffix", testMoveToShallowerFolderShortensSuffix);
	it("move to root removes suffix", testMoveToRootRemovesSuffix);
	it("move folder updates all descendants", testMoveFolderUpdatesAllDescendants);
});

