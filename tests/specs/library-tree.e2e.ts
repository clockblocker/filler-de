/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import { testReadTreeFromVault } from "./library-tree/read-tree-from-vault.test";
import { testGetNodeHappyPath } from "./library-tree/tree-navigation.test";
import { VAULT_PATH } from "./library-tree/utils";

describe("LibraryTree", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await browser.executeObsidian(async ({ app }) => {
			await (app as any).commands.executeCommandById(
				"textfresser-testing-expose-opened-service",
			);
		});
	});

	describe("Level 1: Easy Tests (Basic Happy Path)", () => {
		describe("Librarian.readTreeFromVault() - Happy Path", () => {
			it("should read tree from vault and verify structure", testReadTreeFromVault);
		});

		describe("LibraryTree.getNode() - Happy Path", () => {
			it("should get nodes by chain and handle non-existent nodes", testGetNodeHappyPath);
		});
	});
});
