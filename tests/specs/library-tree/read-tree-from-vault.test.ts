/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "../dispatcher/utils";
import type {
	LibrarianTestingApi,
	LibraryTreeApi,
	TreeNodeApi,
} from "./utils";

/**
 * Creates vault actions for the standard test tree structure:
 * Library
 * - Avarar
 *   - S1
 *     - E1-S1-Avarar.md
 *     - E2-S1-Avarar.md
 *   - S2
 *     - E1
 *       - 000_E1-E1-S2-Avarar.md
 *       - 001_E1-E1-S2-Avarar.md
 *     - E2-S1-Avarar.md
 */
export function createTestTreeActions(
	splitPath: (input: string) => unknown,
): unknown[] {
	return [
		// Files in Library/Avarar/S1
		{
			payload: {
				content: "",
				splitPath: splitPath("Library/Avarar/S1/E1-S1-Avarar.md"),
			},
			type: "CreateMdFile",
		},
		{
			payload: {
				content: "",
				splitPath: splitPath("Library/Avarar/S1/E2-S1-Avarar.md"),
			},
			type: "CreateMdFile",
		},
		// Files in Library/Avarar/S2/E1
		{
			payload: {
				content: "",
				splitPath: splitPath("Library/Avarar/S2/E1/000_E1-E1-S2-Avarar.md"),
			},
			type: "CreateMdFile",
		},
		{
			payload: {
				content: "",
				splitPath: splitPath("Library/Avarar/S2/E1/001_E1-E1-S2-Avarar.md"),
			},
			type: "CreateMdFile",
		},
		// File in Library/Avarar/S2
		{
			payload: {
				content: "",
				splitPath: splitPath("Library/Avarar/S2/E2-S1-Avarar.md"),
			},
			type: "CreateMdFile",
		},
	];
}


export const testReadTreeFromVault = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, splitPath: vaultSplitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");
		
		// Create librarian directly in Obsidian context using vaultActionManager
		// This avoids serialization issues - librarian is created and used in same context
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
		
		// Debug: verify files were created correctly
		const e1S1Path = vaultSplitPath("Library/Avarar/S1/E1-S1-Avarar.md");
		const e1S1Exists = await manager.exists(e1S1Path);
		const e1S1Content = e1S1Exists ? await manager.readContent(e1S1Path) : null;

		// Read tree from vault and verify structure in Obsidian context
		// Don't return tree directly - it has circular references
		// Instead, call getNode methods and return serializable data
		const tree = (await librarian.readTreeFromVault()) as LibraryTreeApi;
		
		// Debug: serialize tree to see what files were actually read
		const serialized = tree.serializeToLeaves() as any[];
		const filePaths = serialized.map((leaf: any) => ({
			coreName: leaf.coreName,
			coreNameChainToParent: leaf.coreNameChainToParent,
			tRefPath: leaf.tRef?.path,
		}));
		
		// Verify structure by calling getNode and returning serializable node data
		const root = tree.getNode([]) as TreeNodeApi | null;
		const avarar = tree.getNode(["Avarar"]) as TreeNodeApi | null;
		
		// Debug: check what children avarar has
		const avararChildren = avarar?.children?.map(c => c.coreName) || [];
		
		const s1 = tree.getNode(["Avarar", "S1"]) as TreeNodeApi | null;
		const s2 = tree.getNode(["Avarar", "S2"]) as TreeNodeApi | null;
		const e1 = tree.getNode(["Avarar", "S2", "E1"]) as TreeNodeApi | null;
		const e1S1Avarar = tree.getNode(["Avarar", "S1", "E1"]) as TreeNodeApi | null;
		const e2S1Avarar = tree.getNode(["Avarar", "S1", "E2"]) as TreeNodeApi | null;
		const file000 = tree.getNode(["Avarar", "S2", "E1", "000_E1"]) as TreeNodeApi | null;
		const file001 = tree.getNode(["Avarar", "S2", "E1", "001_E1"]) as TreeNodeApi | null;
		const e2S2Avarar = tree.getNode(["Avarar", "S2", "E2"]) as TreeNodeApi | null;

		// Return serializable verification data
		return {
			avarar: avarar ? { coreName: avarar.coreName, coreNameChainToParent: avarar.coreNameChainToParent, type: avarar.type } : null,
			debug: {
				avararChildren: avararChildren,
				avararExists: avarar !== null,
				e1S1Content: e1S1Content,
				e1S1Exists: e1S1Exists,
				filePaths: filePaths,
				hasGetNode: typeof tree.getNode === "function",
				rootExists: root !== null,
				s1Exists: s1 !== null,
				treeType: typeof tree,
			},
			e1: e1 ? { coreName: e1.coreName, coreNameChainToParent: e1.coreNameChainToParent, type: e1.type } : null,
			e1S1Avarar: e1S1Avarar ? { coreName: e1S1Avarar.coreName, coreNameChainToParent: e1S1Avarar.coreNameChainToParent, type: e1S1Avarar.type } : null,
			e2S1Avarar: e2S1Avarar ? { coreName: e2S1Avarar.coreName, coreNameChainToParent: e2S1Avarar.coreNameChainToParent, type: e2S1Avarar.type } : null,
			e2S2Avarar: e2S2Avarar ? { coreName: e2S2Avarar.coreName, coreNameChainToParent: e2S2Avarar.coreNameChainToParent, type: e2S2Avarar.type } : null,
			file000: file000 ? { coreName: file000.coreName, coreNameChainToParent: file000.coreNameChainToParent, type: file000.type } : null,
			file001: file001 ? { coreName: file001.coreName, coreNameChainToParent: file001.coreNameChainToParent, type: file001.type } : null,
			root: root ? { coreName: root.coreName, coreNameChainToParent: root.coreNameChainToParent, type: root.type } : null,
			s1: s1 ? { coreName: s1.coreName, coreNameChainToParent: s1.coreNameChainToParent, type: s1.type } : null,
			s2: s2 ? { coreName: s2.coreName, coreNameChainToParent: s2.coreNameChainToParent, type: s2.type } : null,
			success: true,
		};
	});

	expect(result.success).toBe(true);
	
	// // Debug output
	// if (result.debug) {
	// 	console.log("Debug info:", JSON.stringify(result.debug, null, 2));
	// }
	
	// Verify structure from serialized data
	expect(result.root).not.toBeNull();
	expect(result.root?.type).toBe("Section");
	expect(result.root?.coreName).toBe("");
	expect(result.root?.coreNameChainToParent).toEqual([]);
	
	expect(result.avarar).not.toBeNull();
	expect(result.avarar?.type).toBe("Section");
	expect(result.avarar?.coreName).toBe("Avarar");
	expect(result.avarar?.coreNameChainToParent).toEqual([]);
	
	expect(result.s1).not.toBeNull();
	expect(result.s1?.type).toBe("Section");
	expect(result.s1?.coreName).toBe("S1");
	expect(result.s1?.coreNameChainToParent).toEqual(["Avarar"]);
	
	expect(result.s2).not.toBeNull();
	expect(result.s2?.type).toBe("Section");
	expect(result.s2?.coreName).toBe("S2");
	expect(result.s2?.coreNameChainToParent).toEqual(["Avarar"]);
	
	expect(result.e1).not.toBeNull();
	expect(result.e1?.type).toBe("Section");
	expect(result.e1?.coreName).toBe("E1");
	expect(result.e1?.coreNameChainToParent).toEqual(["Avarar", "S2"]);
	
	expect(result.e1S1Avarar).not.toBeNull();
	expect(result.e1S1Avarar?.type).toBe("Scroll");
	expect(result.e1S1Avarar?.coreName).toBe("E1");
	expect(result.e1S1Avarar?.coreNameChainToParent).toEqual(["Avarar", "S1"]);
	
	expect(result.e2S1Avarar).not.toBeNull();
	expect(result.e2S1Avarar?.type).toBe("Scroll");
	expect(result.e2S1Avarar?.coreName).toBe("E2");
	expect(result.e2S1Avarar?.coreNameChainToParent).toEqual(["Avarar", "S1"]);
	
	expect(result.file000).not.toBeNull();
	expect(result.file000?.type).toBe("Scroll");
	expect(result.file000?.coreName).toBe("000_E1");
	expect(result.file000?.coreNameChainToParent).toEqual(["Avarar", "S2", "E1"]);
	
	expect(result.file001).not.toBeNull();
	expect(result.file001?.type).toBe("Scroll");
	expect(result.file001?.coreName).toBe("001_E1");
	expect(result.file001?.coreNameChainToParent).toEqual(["Avarar", "S2", "E1"]);
	
	expect(result.e2S2Avarar).not.toBeNull();
	expect(result.e2S2Avarar?.type).toBe("Scroll");
	expect(result.e2S2Avarar?.coreName).toBe("E2");
	expect(result.e2S2Avarar?.coreNameChainToParent).toEqual(["Avarar", "S2"]);
};
