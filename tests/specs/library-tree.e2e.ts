/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import { testReadTreeFromVault } from "./library-tree/read-tree-from-vault.test";
import {
	testChangeNodeNameAction,
	testChangeNodeStatusAction,
	testCreateNodeAction,
	testDeleteNodeAction,
} from "./library-tree/tree-actions.test";
import { testGetNodeHappyPath } from "./library-tree/tree-navigation.test";
import {
	testSerializeRoundTrip,
	testSerializeToLeaves,
} from "./library-tree/tree-serialization.test";
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

		describe("LibraryTree.serializeToLeaves() - Happy Path", () => {
			it("should serialize tree to leaf array", testSerializeToLeaves);
			it("should round-trip serialize and rebuild identical tree", testSerializeRoundTrip);
		});
	});

	describe("Level 2: Medium Tests (Tree Actions)", () => {
		describe("LibraryTree.applyTreeAction() - CreateNode", () => {
			it("should create a new section node", testCreateNodeAction);
		});

		describe("LibraryTree.applyTreeAction() - DeleteNode", () => {
			it("should delete a node and update parent", testDeleteNodeAction);
		});

		describe("LibraryTree.applyTreeAction() - ChangeNodeName", () => {
			it("should rename a node", testChangeNodeNameAction);
		});

		describe("LibraryTree.applyTreeAction() - ChangeNodeStatus", () => {
			it("should change node status", testChangeNodeStatusAction);
		});
	});
});
