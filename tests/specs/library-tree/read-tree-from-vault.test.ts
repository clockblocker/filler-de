/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import { logger } from "../../../src/utils/logger";
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
 *     - E2-S2-Avarar.md
 */
export function createTestTreeActions(
	makeSplitPath: (input: string) => unknown,
): unknown[] {
	return [
		// Files in Library/Avarar/S1
		{
			payload: {
				content: "",
				makeSplitPath: makeSplitPath("Library/Avarar/S1/E1-S1-Avarar.md"),
			},
			type: "UpsertMdFile",
		},
		{
			payload: {
				content: "",
				makeSplitPath: makeSplitPath("Library/Avarar/S1/E2-S1-Avarar.md"),
			},
			type: "UpsertMdFile",
		},
		// Files in Library/Avarar/S2/E1
		{
			payload: {
				content: "",
				makeSplitPath: makeSplitPath("Library/Avarar/S2/E1/000_E1-E1-S2-Avarar.md"),
			},
			type: "UpsertMdFile",
		},
		{
			payload: {
				content: "",
				makeSplitPath: makeSplitPath("Library/Avarar/S2/E1/001_E1-E1-S2-Avarar.md"),
			},
			type: "UpsertMdFile",
		},
		// File in Library/Avarar/S2
		{
			payload: {
				content: "",
				makeSplitPath: makeSplitPath("Library/Avarar/S2/E2-S2-Avarar.md"),
			},
			type: "UpsertMdFile",
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

		const { manager, makeSplitPath: vaultSplitPath } = vaultApi;
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

		// Helper to create meta section with status
		const makeMeta = (status: "Done" | "NotStarted") =>
			`<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Scroll","status":"${status}"}\n</section>\n`;

		// File paths for test structure
		const files = [
			{ path: "Library/Avarar/S1/E1-S1-Avarar.md", status: "Done" as const },
			{ path: "Library/Avarar/S1/E2-S1-Avarar.md", status: "NotStarted" as const },
			{ path: "Library/Avarar/S2/E1/000_E1-E1-S2-Avarar.md", status: "Done" as const },
			{ path: "Library/Avarar/S2/E1/001_E1-E1-S2-Avarar.md", status: "Done" as const },
			{ path: "Library/Avarar/S2/E2-S2-Avarar.md", status: "Done" as const },
		];

		// First create files (may already exist)
		const createActions = files.map(({ path }) => ({
			payload: {
				content: "",
				makeSplitPath: vaultSplitPath(path),
			},
			type: "UpsertMdFile",
		}));
		await manager.dispatch(createActions);

		// Then write metadata content to ensure correct status
		const writeActions = files.map(({ path, status }) => ({
			payload: {
				content: makeMeta(status),
				makeSplitPath: vaultSplitPath(path),
			},
			type: "UpsertMdFile",
		}));
		await manager.dispatch(writeActions);
		
		// Small delay to ensure cache is updated
		await new Promise(resolve => setTimeout(resolve, 100));
		
		// Debug: verify files were created correctly with content
		const e1S1Path = vaultSplitPath("Library/Avarar/S1/E1-S1-Avarar.md");
		const e1S1Exists = await manager.exists(e1S1Path);
		const e1S1Content = e1S1Exists ? await manager.readContent(e1S1Path) : null;
		const expectedMeta = makeMeta("Done");

		// Test withStatusFromMeta directly to debug
		const testPath = vaultSplitPath("Library/Avarar/S1/E1-S1-Avarar.md");
		const testContent = await manager.readContent(testPath);
		
		// Get extractMetaInfo from plugin
		const extractMetaInfoFn = plugin.getExtractMetaInfo?.();
		const testMeta = extractMetaInfoFn ? extractMetaInfoFn(testContent) : null;
		
		// Read tree from vault and verify structure in Obsidian context
		// Don't return tree directly - it has circular references
		// Instead, call getNode methods and return serializable data
		const tree = (await librarian.readTreeFromVault()) as LibraryTreeApi;
		
		// Debug: serialize tree to see what files were actually read
		const serialized = tree.serializeToLeaves() as any[];
		const filePaths = serialized.map((leaf: any) => ({
			nodeName: leaf.nodeName,
			nodeNameChainToParent: leaf.nodeNameChainToParent,
			status: leaf.status,
			tRefPath: leaf.tRef?.path,
		}));
		
		// Verify structure by calling getNode and returning serializable node data
		const root = tree.getNode([]) as TreeNodeApi | null;
		const avarar = tree.getNode(["Avarar"]) as TreeNodeApi | null;
		
		// Debug: check what children avarar has
		const avararChildren = avarar?.children?.map(c => c.nodeName) || [];
		
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
			avarar: avarar ? { nodeName: avarar.nodeName, nodeNameChainToParent: avarar.nodeNameChainToParent, status: avarar.status, type: avarar.type } : null,
			debug: {
				avararChildren: avararChildren,
				avararExists: avarar !== null,
				e1S1Content: e1S1Content,
				e1S1Exists: e1S1Exists,
				expectedMeta: expectedMeta,
				filePaths: filePaths,
				hasGetNode: typeof tree.getNode === "function",
				rootExists: root !== null,
				s1Exists: s1 !== null,
				testContent: testContent,
				testMeta: testMeta,
				treeType: typeof tree,
			},
			e1: e1 ? { nodeName: e1.nodeName, nodeNameChainToParent: e1.nodeNameChainToParent, status: e1.status, type: e1.type } : null,
			e1S1Avarar: e1S1Avarar ? { nodeName: e1S1Avarar.nodeName, nodeNameChainToParent: e1S1Avarar.nodeNameChainToParent, status: e1S1Avarar.status, type: e1S1Avarar.type } : null,
			e2S1Avarar: e2S1Avarar ? { nodeName: e2S1Avarar.nodeName, nodeNameChainToParent: e2S1Avarar.nodeNameChainToParent, status: e2S1Avarar.status, type: e2S1Avarar.type } : null,
			e2S2Avarar: e2S2Avarar ? { nodeName: e2S2Avarar.nodeName, nodeNameChainToParent: e2S2Avarar.nodeNameChainToParent, status: e2S2Avarar.status, type: e2S2Avarar.type } : null,
			file000: file000 ? { nodeName: file000.nodeName, nodeNameChainToParent: file000.nodeNameChainToParent, status: file000.status, type: file000.type } : null,
			file001: file001 ? { nodeName: file001.nodeName, nodeNameChainToParent: file001.nodeNameChainToParent, status: file001.status, type: file001.type } : null,
			root: root ? { nodeName: root.nodeName, nodeNameChainToParent: root.nodeNameChainToParent, status: root.status, type: root.type } : null,
			s1: s1 ? { nodeName: s1.nodeName, nodeNameChainToParent: s1.nodeNameChainToParent, status: s1.status, type: s1.type } : null,
			s2: s2 ? { nodeName: s2.nodeName, nodeNameChainToParent: s2.nodeNameChainToParent, status: s2.status, type: s2.type } : null,
			success: true,
		};
	});

	expect(result.success).toBe(true);
	
	// Debug output
	if (result.debug) {
		logger.debug("Debug info:", JSON.stringify(result.debug, null, 2));
	}
	
	// Verify structure from serialized data
	expect(result.root).not.toBeNull();
	expect(result.root?.type).toBe("Section");
	expect(result.root?.nodeName).toBe("");
	expect(result.root?.nodeNameChainToParent).toEqual([]);
	
	expect(result.avarar).not.toBeNull();
	expect(result.avarar?.type).toBe("Section");
	expect(result.avarar?.nodeName).toBe("Avarar");
	expect(result.avarar?.nodeNameChainToParent).toEqual([]);
	
	expect(result.s1).not.toBeNull();
	expect(result.s1?.type).toBe("Section");
	expect(result.s1?.nodeName).toBe("S1");
	expect(result.s1?.nodeNameChainToParent).toEqual(["Avarar"]);
	
	expect(result.s2).not.toBeNull();
	expect(result.s2?.type).toBe("Section");
	expect(result.s2?.nodeName).toBe("S2");
	expect(result.s2?.nodeNameChainToParent).toEqual(["Avarar"]);
	
	expect(result.e1).not.toBeNull();
	expect(result.e1?.type).toBe("Section");
	expect(result.e1?.nodeName).toBe("E1");
	expect(result.e1?.nodeNameChainToParent).toEqual(["Avarar", "S2"]);
	
	// Scroll statuses from metadata
	expect(result.e1S1Avarar).not.toBeNull();
	expect(result.e1S1Avarar?.type).toBe("Scroll");
	expect(result.e1S1Avarar?.nodeName).toBe("E1");
	expect(result.e1S1Avarar?.nodeNameChainToParent).toEqual(["Avarar", "S1"]);
	expect(result.e1S1Avarar?.status).toBe("Done");
	
	expect(result.e2S1Avarar).not.toBeNull();
	expect(result.e2S1Avarar?.type).toBe("Scroll");
	expect(result.e2S1Avarar?.nodeName).toBe("E2");
	expect(result.e2S1Avarar?.nodeNameChainToParent).toEqual(["Avarar", "S1"]);
	expect(result.e2S1Avarar?.status).toBe("NotStarted");
	
	expect(result.file000).not.toBeNull();
	expect(result.file000?.type).toBe("Scroll");
	expect(result.file000?.nodeName).toBe("000_E1");
	expect(result.file000?.nodeNameChainToParent).toEqual(["Avarar", "S2", "E1"]);
	expect(result.file000?.status).toBe("Done");
	
	expect(result.file001).not.toBeNull();
	expect(result.file001?.type).toBe("Scroll");
	expect(result.file001?.nodeName).toBe("001_E1");
	expect(result.file001?.nodeNameChainToParent).toEqual(["Avarar", "S2", "E1"]);
	expect(result.file001?.status).toBe("Done");
	
	expect(result.e2S2Avarar).not.toBeNull();
	expect(result.e2S2Avarar?.type).toBe("Scroll");
	expect(result.e2S2Avarar?.nodeName).toBe("E2");
	expect(result.e2S2Avarar?.nodeNameChainToParent).toEqual(["Avarar", "S2"]);
	expect(result.e2S2Avarar?.status).toBe("Done");

	// Section statuses derived from children
	// S1: has NotStarted child (E2) → NotStarted
	expect(result.s1?.status).toBe("NotStarted");
	// S2: all children Done → Done
	expect(result.s2?.status).toBe("Done");
	// E1 (section): all children Done → Done
	expect(result.e1?.status).toBe("Done");
	// Avarar: has NotStarted child (S1) → NotStarted
	expect(result.avarar?.status).toBe("NotStarted");
	// Root: has NotStarted child → NotStarted
	expect(result.root?.status).toBe("NotStarted");
};
