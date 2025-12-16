/// <reference types="@wdio/globals/types" />

export const VAULT_PATH = "tests/simple";
export const LIBRARY_ROOT = "Library";

// Types use `unknown` because:
// 1. Actual types (LibraryTree, TreeNode, etc.) come from plugin code
// 2. Plugin types aren't accessible in test context due to serialization
// 3. We assert types at call sites: `as unknown as Type`
// 4. Safer than `any` - forces explicit type assertions

export type LibrarianTestingApi = {
	librarian: {
		readTreeFromVault: () => Promise<unknown>; // Promise<LibraryTree>
	};
	splitPath: (input: string) => unknown; // SplitPath
};

export type LibraryTreeApi = {
	getNode: (coreNameChain: unknown[]) => unknown | null; // TreeNode | null
	serializeToTreeLeafDtos: () => unknown[]; // TreeLeafDto[]
};

export type TreeNode = {
	coreName: string;
	type: string; // "Scroll" | "File" | "Section"
	coreNameChainToParent: string[];
	status: string; // "Done" | "NotStarted" | "Unknown"
	tRef?: unknown; // TFile (for Scroll/File nodes)
	children?: TreeNode[]; // For Section nodes
};

// GOLDEN SOURCE PRINCIPLE: Obsidian's actual behavior is always the authoritative source.
// If code/docs/tests conflict with Obsidian's behavior, fix code/docs/tests to match Obsidian.
// Never assume - always verify Obsidian's actual behavior through tests.
