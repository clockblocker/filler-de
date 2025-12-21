import { describe, expect, it } from "bun:test";
import {
	getExpectedBasename,
	healOnInit,
	leafNeedsHealing,
} from "../../../../src/commanders/librarian/healing/init-healer";
import type { TreeLeaf } from "../../../../src/commanders/librarian/types/tree-leaf";
import { TreeNodeStatus, TreeNodeType } from "../../../../src/commanders/librarian/types/tree-node";
import { VaultActionType } from "../../../../src/obsidian-vault-action-manager/types/vault-action";
import { buildCanonicalBasename } from "../../../../src/commanders/librarian/utils/path-suffix-utils";

const LIBRARY_ROOT = "Library";
const DELIMITER = "-";

function scrollLeaf(
	coreName: string,
	coreNameChainToParent: string[],
	currentBasename: string,
): TreeLeaf {
	return {
		coreName,
		coreNameChainToParent,
		status: TreeNodeStatus.NotStarted,
		extension: "md",
		type: TreeNodeType.Scroll,
	};
}

function fileLeaf(
	coreName: string,
	coreNameChainToParent: string[],
	currentBasename: string,
	extension: string,
): TreeLeaf {
	return {
		coreName,
		coreNameChainToParent,
		status: TreeNodeStatus.Unknown,
		extension,
		type: TreeNodeType.File,
	};
}

/**
 * Create getCurrentBasename function for tests.
 * Maps paths to basenames based on leaf structure and currentBasename.
 */
function createGetCurrentBasename(
	leaves: Array<{ leaf: TreeLeaf; currentBasename: string }>,
	libraryRoot: string,
): (path: string) => Promise<string | null> {
	const pathToBasename = new Map<string, string>();
	for (const { leaf, currentBasename } of leaves) {
		const chain = [...leaf.coreNameChainToParent, leaf.coreName];
		const path = chain.length > 0
			? `${libraryRoot}/${chain.join("/")}.${leaf.extension}`
			: `${libraryRoot}/${leaf.coreName}.${leaf.extension}`;
		pathToBasename.set(path, currentBasename);
	}
	return async (path: string) => pathToBasename.get(path) ?? null;
}

describe("healOnInit", () => {
	it("returns empty actions when all leaves are correctly named", async () => {
		const leaves: TreeLeaf[] = [
			scrollLeaf("Note", ["A", "B"], "Note-B-A"),
			scrollLeaf("Doc", ["X"], "Doc-X"),
		];

		const leavesWithBasenames = [
			{ leaf: leaves[0], currentBasename: "Note-B-A" },
			{ leaf: leaves[1], currentBasename: "Doc-X" },
		];
		const getCurrentBasename = createGetCurrentBasename(leavesWithBasenames, LIBRARY_ROOT);

		const result = await healOnInit(leaves, LIBRARY_ROOT, DELIMITER, getCurrentBasename);

		expect(result.renameActions).toHaveLength(0);
	});

	it("generates rename action for mismatched suffix", async () => {
		const leaves: TreeLeaf[] = [
			scrollLeaf("Note", ["A", "B"], "Note-X-Y"), // Wrong suffix
		];

		const leavesWithBasenames = [
			{ leaf: leaves[0], currentBasename: "Note-X-Y" },
		];
		const getCurrentBasename = createGetCurrentBasename(leavesWithBasenames, LIBRARY_ROOT);

		const result = await healOnInit(leaves, LIBRARY_ROOT, DELIMITER, getCurrentBasename);

		expect(result.renameActions).toHaveLength(1);
		const action = result.renameActions[0];
		expect(action.type).toBe(VaultActionType.RenameMdFile);
		
		if (action.type === VaultActionType.RenameMdFile) {
			expect(action.payload.from.basename).toBe("Note-X-Y");
			expect(action.payload.to.basename).toBe("Note-B-A");
		}
	});

	it("handles multiple leaves needing healing", async () => {
		const leaves: TreeLeaf[] = [
			scrollLeaf("Note1", ["A"], "Note1-Wrong"),
			scrollLeaf("Note2", ["B"], "Note2-B"), // Correct
			scrollLeaf("Note3", ["C", "D"], "Note3"), // Missing suffix
		];

		const leavesWithBasenames = [
			{ leaf: leaves[0], currentBasename: "Note1-Wrong" },
			{ leaf: leaves[1], currentBasename: "Note2-B" },
			{ leaf: leaves[2], currentBasename: "Note3" },
		];
		const getCurrentBasename = createGetCurrentBasename(leavesWithBasenames, LIBRARY_ROOT);

		const result = await healOnInit(leaves, LIBRARY_ROOT, DELIMITER, getCurrentBasename);

		expect(result.renameActions).toHaveLength(2);
	});

	it("handles File nodes (non-md)", async () => {
		const leaves: TreeLeaf[] = [
			fileLeaf("image", ["A", "B"], "image-wrong", "png"),
		];

		const leavesWithBasenames = [
			{ leaf: leaves[0], currentBasename: "image-wrong" },
		];
		const getCurrentBasename = createGetCurrentBasename(leavesWithBasenames, LIBRARY_ROOT);

		const result = await healOnInit(leaves, LIBRARY_ROOT, DELIMITER, getCurrentBasename);

		expect(result.renameActions).toHaveLength(1);
		const action = result.renameActions[0];
		expect(action.type).toBe(VaultActionType.RenameFile);
		
		if (action.type === VaultActionType.RenameFile) {
			expect(action.payload.to.basename).toBe("image-B-A");
		}
	});

	it("preserves coreName when fixing suffix", async () => {
		const leaves: TreeLeaf[] = [
			scrollLeaf("MyNote", ["A", "B", "C"], "MyNote-X"),
		];

		const leavesWithBasenames = [
			{ leaf: leaves[0], currentBasename: "MyNote-X" },
		];
		const getCurrentBasename = createGetCurrentBasename(leavesWithBasenames, LIBRARY_ROOT);

		const result = await healOnInit(leaves, LIBRARY_ROOT, DELIMITER, getCurrentBasename);

		expect(result.renameActions).toHaveLength(1);
		const action = result.renameActions[0];
		
		if (action.type === VaultActionType.RenameMdFile) {
			expect(action.payload.to.basename).toBe("MyNote-C-B-A");
		}
	});

	it("handles root-level files (empty chain)", async () => {
		const leaves: TreeLeaf[] = [
			scrollLeaf("RootNote", [], "RootNote-ExtraSuffix"),
		];

		const leavesWithBasenames = [
			{ leaf: leaves[0], currentBasename: "RootNote-ExtraSuffix" },
		];
		const getCurrentBasename = createGetCurrentBasename(leavesWithBasenames, LIBRARY_ROOT);

		const result = await healOnInit(leaves, LIBRARY_ROOT, DELIMITER, getCurrentBasename);

		expect(result.renameActions).toHaveLength(1);
		const action = result.renameActions[0];
		
		if (action.type === VaultActionType.RenameMdFile) {
			expect(action.payload.to.basename).toBe("RootNote");
		}
	});
});

describe("leafNeedsHealing", () => {
	it("returns false when suffix matches path", async () => {
		const leaf = scrollLeaf("Note", ["A", "B"], "Note-B-A");
		const getCurrentBasename = createGetCurrentBasename(
			[{ leaf, currentBasename: "Note-B-A" }],
			LIBRARY_ROOT,
		);
		expect(await leafNeedsHealing(leaf, LIBRARY_ROOT, DELIMITER, getCurrentBasename)).toBe(false);
	});

	it("returns true when suffix mismatches path", async () => {
		const leaf = scrollLeaf("Note", ["A", "B"], "Note-X-Y");
		const getCurrentBasename = createGetCurrentBasename(
			[{ leaf, currentBasename: "Note-X-Y" }],
			LIBRARY_ROOT,
		);
		expect(await leafNeedsHealing(leaf, LIBRARY_ROOT, DELIMITER, getCurrentBasename)).toBe(true);
	});

	it("returns true when suffix is missing", async () => {
		const leaf = scrollLeaf("Note", ["A"], "Note");
		const getCurrentBasename = createGetCurrentBasename(
			[{ leaf, currentBasename: "Note" }],
			LIBRARY_ROOT,
		);
		expect(await leafNeedsHealing(leaf, LIBRARY_ROOT, DELIMITER, getCurrentBasename)).toBe(true);
	});

	it("returns false for root-level file without suffix", async () => {
		const leaf = scrollLeaf("Note", [], "Note");
		const getCurrentBasename = createGetCurrentBasename(
			[{ leaf, currentBasename: "Note" }],
			LIBRARY_ROOT,
		);
		expect(await leafNeedsHealing(leaf, LIBRARY_ROOT, DELIMITER, getCurrentBasename)).toBe(false);
	});
});

describe("getExpectedBasename", () => {
	it("returns correct basename for nested path", () => {
		const leaf = scrollLeaf("Note", ["A", "B", "C"], "Note-wrong");
		expect(getExpectedBasename(leaf, DELIMITER)).toBe("Note-C-B-A");
	});

	it("returns coreName only for root level", () => {
		const leaf = scrollLeaf("Note", [], "Note-extra");
		expect(getExpectedBasename(leaf, DELIMITER)).toBe("Note");
	});
});
