import { describe, expect, it } from "bun:test";
import type { TFile } from "obsidian";
import {
	getExpectedBasename,
	healOnInit,
	leafNeedsHealing,
} from "../../../../src/commanders/librarian/healing/init-healer";
import type { TreeLeaf } from "../../../../src/commanders/librarian/types/tree-leaf";
import { TreeNodeStatus, TreeNodeType } from "../../../../src/commanders/librarian/types/tree-node";
import { VaultActionType } from "../../../../src/obsidian-vault-action-manager/types/vault-action";

const LIBRARY_ROOT = "Library";
const DELIMITER = "-";

function mockTFile(basename: string, extension: string, path: string): TFile {
	return {
		basename,
		extension,
		name: `${basename}.${extension}`,
		path,
		// Other TFile properties not needed for tests
	} as TFile;
}

function scrollLeaf(
	coreName: string,
	coreNameChainToParent: string[],
	currentBasename: string,
): TreeLeaf {
	const path = [LIBRARY_ROOT, ...coreNameChainToParent, `${currentBasename}.md`].join("/");
	return {
		coreName,
		coreNameChainToParent,
		status: TreeNodeStatus.NotStarted,
		tRef: mockTFile(currentBasename, "md", path),
		type: TreeNodeType.Scroll,
	};
}

function fileLeaf(
	coreName: string,
	coreNameChainToParent: string[],
	currentBasename: string,
	extension: string,
): TreeLeaf {
	const path = [LIBRARY_ROOT, ...coreNameChainToParent, `${currentBasename}.${extension}`].join("/");
	return {
		coreName,
		coreNameChainToParent,
		status: TreeNodeStatus.Unknown,
		tRef: mockTFile(currentBasename, extension, path),
		type: TreeNodeType.File,
	};
}

describe("healOnInit", () => {
	it("returns empty actions when all leaves are correctly named", () => {
		const leaves: TreeLeaf[] = [
			scrollLeaf("Note", ["A", "B"], "Note-B-A"),
			scrollLeaf("Doc", ["X"], "Doc-X"),
		];

		const result = healOnInit(leaves, LIBRARY_ROOT, DELIMITER);

		expect(result.renameActions).toHaveLength(0);
	});

	it("generates rename action for mismatched suffix", () => {
		const leaves: TreeLeaf[] = [
			scrollLeaf("Note", ["A", "B"], "Note-X-Y"), // Wrong suffix
		];

		const result = healOnInit(leaves, LIBRARY_ROOT, DELIMITER);

		expect(result.renameActions).toHaveLength(1);
		const action = result.renameActions[0];
		expect(action.type).toBe(VaultActionType.RenameMdFile);
		
		if (action.type === VaultActionType.RenameMdFile) {
			expect(action.payload.from.basename).toBe("Note-X-Y");
			expect(action.payload.to.basename).toBe("Note-B-A");
		}
	});

	it("handles multiple leaves needing healing", () => {
		const leaves: TreeLeaf[] = [
			scrollLeaf("Note1", ["A"], "Note1-Wrong"),
			scrollLeaf("Note2", ["B"], "Note2-B"), // Correct
			scrollLeaf("Note3", ["C", "D"], "Note3"), // Missing suffix
		];

		const result = healOnInit(leaves, LIBRARY_ROOT, DELIMITER);

		expect(result.renameActions).toHaveLength(2);
	});

	it("handles File nodes (non-md)", () => {
		const leaves: TreeLeaf[] = [
			fileLeaf("image", ["A", "B"], "image-wrong", "png"),
		];

		const result = healOnInit(leaves, LIBRARY_ROOT, DELIMITER);

		expect(result.renameActions).toHaveLength(1);
		const action = result.renameActions[0];
		expect(action.type).toBe(VaultActionType.RenameFile);
		
		if (action.type === VaultActionType.RenameFile) {
			expect(action.payload.to.basename).toBe("image-B-A");
		}
	});

	it("preserves coreName when fixing suffix", () => {
		const leaves: TreeLeaf[] = [
			scrollLeaf("MyNote", ["A", "B", "C"], "MyNote-X"),
		];

		const result = healOnInit(leaves, LIBRARY_ROOT, DELIMITER);

		expect(result.renameActions).toHaveLength(1);
		const action = result.renameActions[0];
		
		if (action.type === VaultActionType.RenameMdFile) {
			expect(action.payload.to.basename).toBe("MyNote-C-B-A");
		}
	});

	it("handles root-level files (empty chain)", () => {
		const leaves: TreeLeaf[] = [
			scrollLeaf("RootNote", [], "RootNote-ExtraSuffix"),
		];

		const result = healOnInit(leaves, LIBRARY_ROOT, DELIMITER);

		expect(result.renameActions).toHaveLength(1);
		const action = result.renameActions[0];
		
		if (action.type === VaultActionType.RenameMdFile) {
			expect(action.payload.to.basename).toBe("RootNote");
		}
	});
});

describe("leafNeedsHealing", () => {
	it("returns false when suffix matches path", () => {
		const leaf = scrollLeaf("Note", ["A", "B"], "Note-B-A");
		expect(leafNeedsHealing(leaf, LIBRARY_ROOT, DELIMITER)).toBe(false);
	});

	it("returns true when suffix mismatches path", () => {
		const leaf = scrollLeaf("Note", ["A", "B"], "Note-X-Y");
		expect(leafNeedsHealing(leaf, LIBRARY_ROOT, DELIMITER)).toBe(true);
	});

	it("returns true when suffix is missing", () => {
		const leaf = scrollLeaf("Note", ["A"], "Note");
		expect(leafNeedsHealing(leaf, LIBRARY_ROOT, DELIMITER)).toBe(true);
	});

	it("returns false for root-level file without suffix", () => {
		const leaf = scrollLeaf("Note", [], "Note");
		expect(leafNeedsHealing(leaf, LIBRARY_ROOT, DELIMITER)).toBe(false);
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
