/// <reference types="@wdio/globals/types" />

export const VAULT_PATH = "tests/simple";

// Types use `unknown` because:
// 1. Actual types (Librarian, LibraryTree, TreeNode, etc.) come from plugin code
// 2. Plugin types aren't accessible in test context due to serialization
// 3. We assert types at call sites: `as unknown as Result<T>`
// 4. Safer than `any` - forces explicit type assertions

export type LibrarianTestingApi = {
	librarian: {
		readTreeFromVault: () => Promise<unknown>; // Promise<LibraryTree>
	} | undefined; // May be undefined if not initialized yet
	splitPath: (input: string) => unknown; // SplitPath
};

export type LibraryTreeApi = {
	getNode: (nodeNameChain: unknown) => unknown; // TreeNode | null
	serializeToLeaves: () => unknown; // TreeLeaf[]
};

export type TreeNodeApi = {
	nodeName: string;
	type: string; // "Scroll" | "File" | "Section"
	nodeNameChainToParent: string[];
	status?: string;
	children?: TreeNodeApi[];
	tRef?: unknown; // TFile
};

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
			type: "UpsertMdFile",
		},
		{
			payload: {
				content: "",
				splitPath: splitPath("Library/Avarar/S1/E2-S1-Avarar.md"),
			},
			type: "UpsertMdFile",
		},
		// Files in Library/Avarar/S2/E1
		{
			payload: {
				content: "",
				splitPath: splitPath("Library/Avarar/S2/E1/000_E1-E1-S2-Avarar.md"),
			},
			type: "UpsertMdFile",
		},
		{
			payload: {
				content: "",
				splitPath: splitPath("Library/Avarar/S2/E1/001_E1-E1-S2-Avarar.md"),
			},
			type: "UpsertMdFile",
		},
		// File in Library/Avarar/S2
		{
			payload: {
				content: "",
				splitPath: splitPath("Library/Avarar/S2/E2-S1-Avarar.md"),
			},
			type: "UpsertMdFile",
		},
	];
}
