/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "../dispatcher/utils";
import type { LibraryTreeApi, TreeNodeApi } from "./utils";

/**
 * Test CreateNode action
 */
export const testCreateNodeAction = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const makeMeta = (status: "Done" | "NotStarted") =>
			`<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Scroll","status":"${status}"}\n</section>\n`;

		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, splitPath: vaultSplitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		const LibrarianClass = plugin.getLibrarianClass();
		const librarian = new LibrarianClass(manager as any, "Library", "-");

		// Create initial file
		await manager.dispatch([
			{
				payload: { content: "", splitPath: vaultSplitPath("Library/A/Note1-A.md") },
				type: "UpsertMdFile",
			},
		]);
		await manager.dispatch([
			{
				payload: { content: makeMeta("Done"), splitPath: vaultSplitPath("Library/A/Note1-A.md") },
				type: "UpsertMdFile",
			},
		]);

		await new Promise((resolve) => setTimeout(resolve, 100));

		const tree = (await librarian.readTreeFromVault()) as LibraryTreeApi;

		// Create a new section node
		tree.applyTreeAction({
			payload: {
				coreName: "NewSection",
				coreNameChainToParent: ["A"],
				nodeType: "Section",
				status: "NotStarted",
			},
			type: "CreateNode",
		});

		const newSection = tree.getNode(["A", "NewSection"]) as TreeNodeApi | null;
		const parentA = tree.getNode(["A"]) as TreeNodeApi | null;

		return {
			newSectionExists: newSection !== null,
			newSectionType: newSection?.type,
			parentChildCount: (parentA as any)?.children?.length ?? 0,
			success: true,
		};
	});

	expect(result.success).toBe(true);
	expect(result.newSectionExists).toBe(true);
	expect(result.newSectionType).toBe("Section");
	expect(result.parentChildCount).toBe(2); // Note1 + NewSection
};

/**
 * Test DeleteNode action
 */
export const testDeleteNodeAction = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const makeMeta = (status: "Done" | "NotStarted") =>
			`<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Scroll","status":"${status}"}\n</section>\n`;

		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, splitPath: vaultSplitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		const LibrarianClass = plugin.getLibrarianClass();
		const librarian = new LibrarianClass(manager as any, "Library", "-");

		// Create two files in section B
		await manager.dispatch([
			{
				payload: { content: "", splitPath: vaultSplitPath("Library/B/Note1-B.md") },
				type: "UpsertMdFile",
			},
			{
				payload: { content: "", splitPath: vaultSplitPath("Library/B/Note2-B.md") },
				type: "UpsertMdFile",
			},
		]);
		await manager.dispatch([
			{
				payload: { content: makeMeta("Done"), splitPath: vaultSplitPath("Library/B/Note1-B.md") },
				type: "UpsertMdFile",
			},
			{
				payload: { content: makeMeta("NotStarted"), splitPath: vaultSplitPath("Library/B/Note2-B.md") },
				type: "UpsertMdFile",
			},
		]);

		await new Promise((resolve) => setTimeout(resolve, 100));

		const tree = (await librarian.readTreeFromVault()) as LibraryTreeApi;

		const beforeDelete = tree.getNode(["B", "Note1"]) as TreeNodeApi | null;
		const parentBefore = tree.getNode(["B"]) as TreeNodeApi | null;
		const childCountBefore = (parentBefore as any)?.children?.length ?? 0;

		// Delete Note1
		tree.applyTreeAction({
			payload: { coreNameChain: ["B", "Note1"] },
			type: "DeleteNode",
		});

		const afterDelete = tree.getNode(["B", "Note1"]) as TreeNodeApi | null;
		const parentAfter = tree.getNode(["B"]) as TreeNodeApi | null;
		const childCountAfter = (parentAfter as any)?.children?.length ?? 0;

		return {
			afterDeleteExists: afterDelete !== null,
			beforeDeleteExists: beforeDelete !== null,
			childCountAfter,
			childCountBefore,
			success: true,
		};
	});

	expect(result.success).toBe(true);
	expect(result.beforeDeleteExists).toBe(true);
	expect(result.afterDeleteExists).toBe(false);
	expect(result.childCountBefore).toBe(2);
	expect(result.childCountAfter).toBe(1);
};

/**
 * Test ChangeNodeName action
 */
export const testChangeNodeNameAction = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const makeMeta = (status: "Done" | "NotStarted") =>
			`<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Scroll","status":"${status}"}\n</section>\n`;

		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, splitPath: vaultSplitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		const LibrarianClass = plugin.getLibrarianClass();
		const librarian = new LibrarianClass(manager as any, "Library", "-");

		await manager.dispatch([
			{
				payload: { content: "", splitPath: vaultSplitPath("Library/C/OldName-C.md") },
				type: "UpsertMdFile",
			},
		]);
		await manager.dispatch([
			{
				payload: { content: makeMeta("Done"), splitPath: vaultSplitPath("Library/C/OldName-C.md") },
				type: "UpsertMdFile",
			},
		]);

		await new Promise((resolve) => setTimeout(resolve, 100));

		const tree = (await librarian.readTreeFromVault()) as LibraryTreeApi;

		const oldNode = tree.getNode(["C", "OldName"]) as TreeNodeApi | null;

		// Rename node
		tree.applyTreeAction({
			payload: {
				coreNameChain: ["C", "OldName"],
				newCoreName: "NewName",
			},
			type: "ChangeNodeName",
		});

		const oldNameNode = tree.getNode(["C", "OldName"]) as TreeNodeApi | null;
		const newNameNode = tree.getNode(["C", "NewName"]) as TreeNodeApi | null;

		return {
			newNameCoreName: newNameNode?.coreName,
			newNameExists: newNameNode !== null,
			newNameStatus: newNameNode?.status,
			oldNameExists: oldNameNode !== null,
			oldNodeExistedBefore: oldNode !== null,
			success: true,
		};
	});

	expect(result.success).toBe(true);
	expect(result.oldNodeExistedBefore).toBe(true);
	expect(result.oldNameExists).toBe(false);
	expect(result.newNameExists).toBe(true);
	expect(result.newNameCoreName).toBe("NewName");
	expect(result.newNameStatus).toBe("Done");
};

/**
 * Test ChangeNodeStatus action
 */
export const testChangeNodeStatusAction = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const makeMeta = (status: "Done" | "NotStarted") =>
			`<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Scroll","status":"${status}"}\n</section>\n`;

		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, splitPath: vaultSplitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		const LibrarianClass = plugin.getLibrarianClass();
		const librarian = new LibrarianClass(manager as any, "Library", "-");

		await manager.dispatch([
			{
				payload: { content: "", splitPath: vaultSplitPath("Library/D/Note-D.md") },
				type: "UpsertMdFile",
			},
		]);
		await manager.dispatch([
			{
				payload: { content: makeMeta("NotStarted"), splitPath: vaultSplitPath("Library/D/Note-D.md") },
				type: "UpsertMdFile",
			},
		]);

		await new Promise((resolve) => setTimeout(resolve, 100));

		const tree = (await librarian.readTreeFromVault()) as LibraryTreeApi;

		const nodeBefore = tree.getNode(["D", "Note"]) as TreeNodeApi | null;
		const statusBefore = nodeBefore?.status;

		// Change status
		tree.applyTreeAction({
			payload: {
				coreNameChain: ["D", "Note"],
				newStatus: "Done",
			},
			type: "ChangeNodeStatus",
		});

		const nodeAfter = tree.getNode(["D", "Note"]) as TreeNodeApi | null;
		const statusAfter = nodeAfter?.status;

		return {
			statusAfter,
			statusBefore,
			success: true,
		};
	});

	expect(result.success).toBe(true);
	expect(result.statusBefore).toBe("NotStarted");
	expect(result.statusAfter).toBe("Done");
};
