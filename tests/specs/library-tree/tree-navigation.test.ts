/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "../dispatcher/utils";
import type {
	LibrarianTestingApi,
	LibraryTreeApi,
	TreeNodeApi,
} from "./utils";

export const testGetNodeHappyPath = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, splitPath: vaultSplitPath } = vaultApi;
		
		// Create librarian directly in Obsidian context using vaultActionManager
		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		if (!plugin) throw new Error("plugin not available");
		if (!plugin.getLibrarianClass) throw new Error("getLibrarianClass not available");
		
		const LibrarianClass = plugin.getLibrarianClass();
		if (!LibrarianClass) {
			throw new Error("Librarian class not available");
		}
		
		const librarian = new LibrarianClass(
			manager as any,
			"Library",
			"-",
		);

		// Create test structure - define inline since functions can't be imported
		const actions = [
			{
				payload: {
					content: "",
					splitPath: vaultSplitPath("Library/Avarar/S1/E1-S1-Avarar.md"),
				},
				type: "CreateMdFile",
			},
			{
				payload: {
					content: "",
					splitPath: vaultSplitPath("Library/Avarar/S1/E2-S1-Avarar.md"),
				},
				type: "CreateMdFile",
			},
			{
				payload: {
					content: "",
					splitPath: vaultSplitPath("Library/Avarar/S2/E1/000_E1-E1-S2-Avarar.md"),
				},
				type: "CreateMdFile",
			},
			{
				payload: {
					content: "",
					splitPath: vaultSplitPath("Library/Avarar/S2/E1/001_E1-E1-S2-Avarar.md"),
				},
				type: "CreateMdFile",
			},
			{
				payload: {
					content: "",
					splitPath: vaultSplitPath("Library/Avarar/S2/E2-S1-Avarar.md"),
				},
				type: "CreateMdFile",
			},
		];
		await manager.dispatch(actions);

		// Read tree from vault
		const tree = (await librarian.readTreeFromVault()) as LibraryTreeApi;

		// Test getNode with various chains
		const root = tree.getNode([]) as TreeNodeApi | null;
		const avarar = tree.getNode(["Avarar"]) as TreeNodeApi | null;
		const s1 = tree.getNode(["Avarar", "S1"]) as TreeNodeApi | null;
		const e1File = tree.getNode(["Avarar", "S1", "E1"]) as TreeNodeApi | null;
		const nonExistent = tree.getNode(["NonExistent"]) as TreeNodeApi | null;

		return {
			avarar: avarar ? { coreName: avarar.coreName, type: avarar.type } : null,
			e1File: e1File
				? { coreName: e1File.coreName, type: e1File.type }
				: null,
			nonExistent,
			root: root ? { coreName: root.coreName, type: root.type } : null,
			s1: s1 ? { coreName: s1.coreName, type: s1.type } : null,
			success: true,
		};
	});

	expect(result.success).toBe(true);
	expect(result.root).not.toBeNull();
	expect(result.root?.type).toBe("Section");
	expect(result.root?.coreName).toBe("");
	expect(result.avarar).not.toBeNull();
	expect(result.avarar?.type).toBe("Section");
	expect(result.avarar?.coreName).toBe("Avarar");
	expect(result.s1).not.toBeNull();
	expect(result.s1?.type).toBe("Section");
	expect(result.s1?.coreName).toBe("S1");
	expect(result.e1File).not.toBeNull();
	expect(result.e1File?.type).toBe("Scroll");
	expect(result.e1File?.coreName).toBe("E1");
	expect(result.nonExistent).toBeNull();
};
