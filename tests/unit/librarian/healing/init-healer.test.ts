import { describe, expect, it } from "bun:test";
import {
	getExpectedBasename,
	healOnInit,
	leafNeedsHealing,
} from "../../../../src/commanders/librarian/healing/init-healer";
import type { TreeLeaf } from "../../../../src/commanders/librarian/types/tree-leaf";
import { TreeNodeStatus, TreeNodeType } from "../../../../src/commanders/librarian/types/tree-node";
import type { SplitPathWithReader } from "../../../../src/obsidian-vault-action-manager/types/split-path";
import { VaultActionType } from "../../../../src/obsidian-vault-action-manager/types/vault-action";

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
		extension: "md",
		status: TreeNodeStatus.NotStarted,
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
		extension,
		status: TreeNodeStatus.Unknown,
		type: TreeNodeType.File,
	};
}

/**
 * Create actualFiles array for tests.
 * Converts leaves with basenames to SplitPathWithReader format.
 */
function createActualFiles(
	leaves: Array<{ leaf: TreeLeaf; currentBasename: string }>,
	libraryRoot: string,
): SplitPathWithReader[] {
	const actualFiles: SplitPathWithReader[] = [];
	for (const { leaf, currentBasename } of leaves) {
		const pathParts = [libraryRoot, ...leaf.coreNameChainToParent];
		if (leaf.type === TreeNodeType.Scroll) {
			actualFiles.push({
				basename: currentBasename,
				extension: "md",
				pathParts,
				read: async () => "",
				type: "MdFile",
			});
		} else {
			actualFiles.push({
				basename: currentBasename,
				extension: leaf.extension,
				pathParts,
				type: "File",
			});
		}
	}
	return actualFiles;
}

describe("healOnInit", () => {
	it("returns empty actions when all leaves are correctly named", async () => {
		const leaves: TreeLeaf[] = [
			scrollLeaf("Note", ["A", "B"], "Note-B-A"),
			scrollLeaf("Doc", ["X"], "Doc-X"),
		];

		const leavesWithBasenames = [
			{ currentBasename: "Note-B-A", leaf: leaves[0]! },
			{ currentBasename: "Doc-X", leaf: leaves[1]! },
		];
		const actualFiles = createActualFiles(leavesWithBasenames, LIBRARY_ROOT);

		const result = await healOnInit(leaves, actualFiles, LIBRARY_ROOT, DELIMITER);

		expect(result.renameActions).toHaveLength(0);
	});

	it("generates rename action for mismatched suffix", async () => {
		const leaves: TreeLeaf[] = [
			scrollLeaf("Note", ["A", "B"], "Note-X-Y"), // Wrong suffix
		];

		const leavesWithBasenames = [
			{ currentBasename: "Note-X-Y", leaf: leaves[0]! },
		];
		const actualFiles = createActualFiles(leavesWithBasenames, LIBRARY_ROOT);

		const result = await healOnInit(leaves, actualFiles, LIBRARY_ROOT, DELIMITER);

		expect(result.renameActions).toHaveLength(1);
		const action = result.renameActions[0]!;
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
			{ currentBasename: "Note1-Wrong", leaf: leaves[0]! },
			{ currentBasename: "Note2-B", leaf: leaves[1]! },
			{ currentBasename: "Note3", leaf: leaves[2]! },
		];
		const actualFiles = createActualFiles(leavesWithBasenames, LIBRARY_ROOT);

		const result = await healOnInit(leaves, actualFiles, LIBRARY_ROOT, DELIMITER);

		expect(result.renameActions).toHaveLength(2);
	});

	it("handles File nodes (non-md)", async () => {
		const leaves: TreeLeaf[] = [
			fileLeaf("image", ["A", "B"], "image-wrong", "png"),
		];

		const leavesWithBasenames = [
			{ currentBasename: "image-wrong", leaf: leaves[0]! },
		];
		const actualFiles = createActualFiles(leavesWithBasenames, LIBRARY_ROOT);

		const result = await healOnInit(leaves, actualFiles, LIBRARY_ROOT, DELIMITER);

		expect(result.renameActions).toHaveLength(1);
		const action = result.renameActions[0]!;
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
			{ currentBasename: "MyNote-X", leaf: leaves[0]! },
		];
		const actualFiles = createActualFiles(leavesWithBasenames, LIBRARY_ROOT);

		const result = await healOnInit(leaves, actualFiles, LIBRARY_ROOT, DELIMITER);

		expect(result.renameActions).toHaveLength(1);
		const action = result.renameActions[0]!;
		
		if (action.type === VaultActionType.RenameMdFile) {
			expect(action.payload.to.basename).toBe("MyNote-C-B-A");
		}
	});

	it("handles root-level files (empty chain)", async () => {
		const leaves: TreeLeaf[] = [
			scrollLeaf("RootNote", [], "RootNote-ExtraSuffix"),
		];

		const leavesWithBasenames = [
			{ currentBasename: "RootNote-ExtraSuffix", leaf: leaves[0]! },
		];
		const actualFiles = createActualFiles(leavesWithBasenames, LIBRARY_ROOT);

		const result = await healOnInit(leaves, actualFiles, LIBRARY_ROOT, DELIMITER);

		expect(result.renameActions).toHaveLength(1);
		const action = result.renameActions[0]!;
		
		if (action.type === VaultActionType.RenameMdFile) {
			expect(action.payload.to.basename).toBe("RootNote");
		}
	});
});

describe("leafNeedsHealing", () => {
	it("returns false when suffix matches path", () => {
		const leaf = scrollLeaf("Note", ["A", "B"], "Note-B-A");
		const actualFiles = createActualFiles(
			[{ currentBasename: "Note-B-A", leaf }],
			LIBRARY_ROOT,
		);
		expect(leafNeedsHealing(leaf, actualFiles, DELIMITER)).toBe(false);
	});

	it("returns true when suffix mismatches path", () => {
		const leaf = scrollLeaf("Note", ["A", "B"], "Note-X-Y");
		const actualFiles = createActualFiles(
			[{ currentBasename: "Note-X-Y", leaf }],
			LIBRARY_ROOT,
		);
		expect(leafNeedsHealing(leaf, actualFiles, DELIMITER)).toBe(true);
	});

	it("returns true when suffix is missing", () => {
		const leaf = scrollLeaf("Note", ["A"], "Note");
		const actualFiles = createActualFiles(
			[{ currentBasename: "Note", leaf }],
			LIBRARY_ROOT,
		);
		expect(leafNeedsHealing(leaf, actualFiles, DELIMITER)).toBe(true);
	});

	it("returns false for root-level file without suffix", () => {
		const leaf = scrollLeaf("Note", [], "Note");
		const actualFiles = createActualFiles(
			[{ currentBasename: "Note", leaf }],
			LIBRARY_ROOT,
		);
		expect(leafNeedsHealing(leaf, actualFiles, DELIMITER)).toBe(false);
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
