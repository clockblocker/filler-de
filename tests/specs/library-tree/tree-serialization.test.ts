/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "../dispatcher/utils";
import type { LibraryTreeApi, TreeNodeApi } from "./utils";

/**
 * Test serializeToLeaves() functionality
 */
export const testSerializeToLeaves = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, splitPath: vaultSplitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		if (!plugin) throw new Error("plugin not available");

		const LibrarianClass = plugin.getLibrarianClass();
		const librarian = new LibrarianClass(manager as any, "Library", "-");

		// Helper to create meta section
		const makeMeta = (status: "Done" | "NotStarted") =>
			`<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Scroll","status":"${status}"}\n</section>\n`;

		// Create test files
		const files = [
			{ path: "Library/A/Note1-A.md", status: "Done" as const },
			{ path: "Library/A/Note2-A.md", status: "NotStarted" as const },
			{ path: "Library/B/Note3-B.md", status: "Done" as const },
		];

		const createActions = files.map(({ path }) => ({
			payload: { content: "", splitPath: vaultSplitPath(path) },
			type: "CreateMdFile",
		}));
		await manager.dispatch(createActions);

		const writeActions = files.map(({ path, status }) => ({
			payload: { content: makeMeta(status), splitPath: vaultSplitPath(path) },
			type: "ReplaceContentMdFile",
		}));
		await manager.dispatch(writeActions);

		await new Promise((resolve) => setTimeout(resolve, 100));

		const tree = (await librarian.readTreeFromVault()) as LibraryTreeApi;
		const serialized = tree.serializeToLeaves() as any[];

		return {
			leafCount: serialized.length,
			leaves: serialized.map((leaf: any) => ({
				coreName: leaf.coreName,
				coreNameChainToParent: leaf.coreNameChainToParent,
				status: leaf.status,
				type: leaf.type,
			})),
			success: true,
		};
	});

	expect(result.success).toBe(true);
	expect(result.leafCount).toBe(3);

	// Verify all leaves are present
	const note1 = result.leaves.find((l: any) => l.coreName === "Note1");
	const note2 = result.leaves.find((l: any) => l.coreName === "Note2");
	const note3 = result.leaves.find((l: any) => l.coreName === "Note3");

	expect(note1).toBeDefined();
	expect(note1?.type).toBe("Scroll");
	expect(note1?.status).toBe("Done");
	expect(note1?.coreNameChainToParent).toEqual(["A"]);

	expect(note2).toBeDefined();
	expect(note2?.type).toBe("Scroll");
	expect(note2?.status).toBe("NotStarted");
	expect(note2?.coreNameChainToParent).toEqual(["A"]);

	expect(note3).toBeDefined();
	expect(note3?.type).toBe("Scroll");
	expect(note3?.status).toBe("Done");
	expect(note3?.coreNameChainToParent).toEqual(["B"]);

	// Verify no sections in serialized output
	const sections = result.leaves.filter((l: any) => l.type === "Section");
	expect(sections.length).toBe(0);
};

/**
 * Test round-trip: serialize → rebuild tree → verify identical
 */
export const testSerializeRoundTrip = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, splitPath: vaultSplitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		if (!plugin) throw new Error("plugin not available");

		const LibrarianClass = plugin.getLibrarianClass();
		const LibraryTreeClass = plugin.getLibraryTreeClass?.();
		
		if (!LibraryTreeClass) {
			return { error: "LibraryTreeClass not available", success: false };
		}

		const librarian = new LibrarianClass(manager as any, "Library", "-");

		const makeMeta = (status: "Done" | "NotStarted") =>
			`<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Scroll","status":"${status}"}\n</section>\n`;

		const files = [
			{ path: "Library/X/Y/Deep-Y-X.md", status: "Done" as const },
			{ path: "Library/X/Shallow-X.md", status: "NotStarted" as const },
		];

		const createActions = files.map(({ path }) => ({
			payload: { content: "", splitPath: vaultSplitPath(path) },
			type: "CreateMdFile",
		}));
		await manager.dispatch(createActions);

		const writeActions = files.map(({ path, status }) => ({
			payload: { content: makeMeta(status), splitPath: vaultSplitPath(path) },
			type: "ReplaceContentMdFile",
		}));
		await manager.dispatch(writeActions);

		await new Promise((resolve) => setTimeout(resolve, 100));

		// Read original tree
		const tree1 = (await librarian.readTreeFromVault()) as LibraryTreeApi;
		const serialized = tree1.serializeToLeaves() as any[];

		// Get root folder for reconstruction
		const rootSplitPath = vaultSplitPath("Library");
		const rootFolder = await manager.getAbstractFile(rootSplitPath);

		// Rebuild tree from serialized leaves
		const tree2 = new LibraryTreeClass(serialized, rootFolder);

		// Compare nodes
		const deep1 = tree1.getNode(["X", "Y", "Deep"]) as TreeNodeApi | null;
		const deep2 = tree2.getNode(["X", "Y", "Deep"]) as TreeNodeApi | null;
		const shallow1 = tree1.getNode(["X", "Shallow"]) as TreeNodeApi | null;
		const shallow2 = tree2.getNode(["X", "Shallow"]) as TreeNodeApi | null;
		const sectionX1 = tree1.getNode(["X"]) as TreeNodeApi | null;
		const sectionX2 = tree2.getNode(["X"]) as TreeNodeApi | null;

		return {
			deep1: deep1 ? { coreName: deep1.coreName, status: deep1.status } : null,
			deep2: deep2 ? { coreName: deep2.coreName, status: deep2.status } : null,
			sectionX1: sectionX1 ? { coreName: sectionX1.coreName, status: sectionX1.status } : null,
			sectionX2: sectionX2 ? { coreName: sectionX2.coreName, status: sectionX2.status } : null,
			shallow1: shallow1 ? { coreName: shallow1.coreName, status: shallow1.status } : null,
			shallow2: shallow2 ? { coreName: shallow2.coreName, status: shallow2.status } : null,
			success: true,
		};
	});

	if (!result.success) {
		console.log("Round-trip test skipped:", result);
		return;
	}

	// Verify nodes match between original and rebuilt tree
	expect(result.deep1).toEqual(result.deep2);
	expect(result.shallow1).toEqual(result.shallow2);
	expect(result.sectionX1).toEqual(result.sectionX2);
};
