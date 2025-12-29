import { describe, expect, it } from "bun:test";
import { buildDependencyGraph } from "../../../src/obsidian-vault-action-manager/impl/actions-processing/dependency-detector";
import { topologicalSort } from "../../../src/obsidian-vault-action-manager/impl/actions-processing/topological-sort";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../src/obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../src/obsidian-vault-action-manager/types/split-path";
import {
	getActionKey,
	type VaultAction,
	VaultActionType,
} from "../../../src/obsidian-vault-action-manager/types/vault-action";

const folder = (
	basename: string,
	pathParts: string[] = [],
): SplitPathToFolder => ({
	basename,
	pathParts,
	type: SplitPathType.Folder,
});

const mdFile = (
	basename: string,
	pathParts: string[] = [],
): SplitPathToMdFile => ({
	basename,
	extension: "md",
	pathParts,
	type: SplitPathType.MdFile,
});

describe("topologicalSort", () => {
	it("should return empty array for empty actions", () => {
		const graph = buildDependencyGraph([]);
		const sorted = topologicalSort([], graph);
		expect(sorted).toEqual([]);
	});

	it("should sort actions with no dependencies", () => {
		const action1: VaultAction = {
			payload: { splitPath: folder("A") },
			type: VaultActionType.CreateFolder,
		};
		const action2: VaultAction = {
			payload: { splitPath: folder("B") },
			type: VaultActionType.CreateFolder,
		};

		const graph = buildDependencyGraph([action1, action2]);
		const sorted = topologicalSort([action1, action2], graph);

		expect(sorted).toHaveLength(2);
		expect(sorted).toContain(action1);
		expect(sorted).toContain(action2);
	});

	it("should respect dependency: UpsertMdFile before ProcessMdFile", () => {
		const create: VaultAction = {
			payload: { content: "", splitPath: mdFile("file") },
			type: VaultActionType.UpsertMdFile,
		};
		const process: VaultAction = {
			payload: {
				splitPath: mdFile("file"),
				transform: async (c) => c,
			},
			type: VaultActionType.ProcessMdFile,
		};

		const graph = buildDependencyGraph([create, process]);
		const sorted = topologicalSort([create, process], graph);

		expect(sorted).toHaveLength(2);
		expect(sorted[0]).toBe(create);
		expect(sorted[1]).toBe(process);
	});

	it("should respect dependency: parent folder before child folder", () => {
		const parent: VaultAction = {
			payload: { splitPath: folder("parent") },
			type: VaultActionType.CreateFolder,
		};
		const child: VaultAction = {
			payload: { splitPath: folder("child", ["parent"]) },
			type: VaultActionType.CreateFolder,
		};

		const graph = buildDependencyGraph([parent, child]);
		const sorted = topologicalSort([parent, child], graph);

		expect(sorted).toHaveLength(2);
		expect(sorted[0]).toBe(parent);
		expect(sorted[1]).toBe(child);
	});

	it("should sort by path depth when no dependencies (shallow first)", () => {
		const deep: VaultAction = {
			payload: { splitPath: folder("deep", ["a", "b", "c"]) },
			type: VaultActionType.CreateFolder,
		};
		const shallow: VaultAction = {
			payload: { splitPath: folder("shallow", ["a"]) },
			type: VaultActionType.CreateFolder,
		};

		const graph = buildDependencyGraph([deep, shallow]);
		const sorted = topologicalSort([deep, shallow], graph);

		expect(sorted).toHaveLength(2);
		expect(sorted[0]).toBe(shallow); // Shallow first
		expect(sorted[1]).toBe(deep);
	});

	it("should handle complex dependency chain", () => {
		const root: VaultAction = {
			payload: { splitPath: folder("root") },
			type: VaultActionType.CreateFolder,
		};
		const sub: VaultAction = {
			payload: { splitPath: folder("sub", ["root"]) },
			type: VaultActionType.CreateFolder,
		};
		const create: VaultAction = {
			payload: { content: "", splitPath: mdFile("file", ["root", "sub"]) },
			type: VaultActionType.UpsertMdFile,
		};
		const process: VaultAction = {
			payload: {
				splitPath: mdFile("file", ["root", "sub"]),
				transform: async (c) => c,
			},
			type: VaultActionType.ProcessMdFile,
		};

		const graph = buildDependencyGraph([root, sub, create, process]);
		const sorted = topologicalSort([root, sub, create, process], graph);

		expect(sorted).toHaveLength(4);
		// Root must come first
		expect(sorted[0]).toBe(root);
		// Sub must come after root
		const subIndex = sorted.indexOf(sub);
		const rootIndex = sorted.indexOf(root);
		expect(subIndex).toBeGreaterThan(rootIndex);
		// Create must come after sub
		const createIndex = sorted.indexOf(create);
		expect(createIndex).toBeGreaterThan(subIndex);
		// Process must come after create
		const processIndex = sorted.indexOf(process);
		expect(processIndex).toBeGreaterThan(createIndex);
	});

	it("should handle parallel actions with same dependency", () => {
		const parentFolder: VaultAction = {
			payload: { splitPath: folder("parent") },
			type: VaultActionType.CreateFolder,
		};
		const file1: VaultAction = {
			payload: { content: "", splitPath: mdFile("file1", ["parent"]) },
			type: VaultActionType.UpsertMdFile,
		};
		const file2: VaultAction = {
			payload: { content: "", splitPath: mdFile("file2", ["parent"]) },
			type: VaultActionType.UpsertMdFile,
		};

		const graph = buildDependencyGraph([parentFolder, file1, file2]);
		const sorted = topologicalSort([parentFolder, file1, file2], graph);

		expect(sorted).toHaveLength(3);
		// Folder must come first
		expect(sorted[0]).toBe(parentFolder);
		// Both files come after folder (order between them doesn't matter)
		const file1Index = sorted.indexOf(file1);
		const file2Index = sorted.indexOf(file2);
		expect(file1Index).toBeGreaterThan(0);
		expect(file2Index).toBeGreaterThan(0);
	});

	it("should throw error on cycle detection", () => {
		// Note: This shouldn't happen in practice, but test the safety check
		// We can't easily create a cycle with our dependency rules,
		// but we can test with a malformed graph
		const action1: VaultAction = {
			payload: { splitPath: folder("A") },
			type: VaultActionType.CreateFolder,
		};
		const action2: VaultAction = {
			payload: { splitPath: folder("B") },
			type: VaultActionType.CreateFolder,
		};

		// Create a graph with a cycle manually (not through buildDependencyGraph)
		const graph = buildDependencyGraph([action1, action2]);
		// Manually create cycle (this shouldn't happen in real usage)
		const key1 = getActionKey(action1);
		const key2 = getActionKey(action2);
		graph.get(key1)!.dependsOn.push(action2);
		graph.get(key2)!.dependsOn.push(action1);

		expect(() => {
			topologicalSort([action1, action2], graph);
		}).toThrow("Cycle detected");
	});

	it("should handle RenameMdFile dependency on destination folder", () => {
		const destFolder: VaultAction = {
			payload: { splitPath: folder("dest") },
			type: VaultActionType.CreateFolder,
		};
		const rename: VaultAction = {
			payload: {
				from: mdFile("file"),
				to: mdFile("file", ["dest"]),
			},
			type: VaultActionType.RenameMdFile,
		};

		const graph = buildDependencyGraph([destFolder, rename]);
		const sorted = topologicalSort([destFolder, rename], graph);

		expect(sorted).toHaveLength(2);
		expect(sorted[0]).toBe(destFolder);
		expect(sorted[1]).toBe(rename);
	});

	it("should sort UpsertMdFile(null) before ProcessMdFile (EnsureExist)", () => {
		const ensureExist: VaultAction = {
			payload: { content: null, splitPath: mdFile("file") },
			type: VaultActionType.UpsertMdFile,
		};
		const process: VaultAction = {
			payload: {
				splitPath: mdFile("file"),
				transform: async (c) => c,
			},
			type: VaultActionType.ProcessMdFile,
		};

		const graph = buildDependencyGraph([ensureExist, process]);
		const sorted = topologicalSort([ensureExist, process], graph);

		expect(sorted).toHaveLength(2);
		expect(sorted[0]).toBe(ensureExist);
		expect(sorted[1]).toBe(process);
	});

	it("should sort EnsureExist folders recursively (parent before child)", () => {
		const root: VaultAction = {
			payload: { splitPath: folder("root") },
			type: VaultActionType.CreateFolder,
		};
		const parent: VaultAction = {
			payload: { splitPath: folder("parent", ["root"]) },
			type: VaultActionType.CreateFolder,
		};
		const child: VaultAction = {
			payload: { splitPath: folder("child", ["root", "parent"]) },
			type: VaultActionType.CreateFolder,
		};

		const graph = buildDependencyGraph([root, parent, child]);
		const sorted = topologicalSort([root, parent, child], graph);

		expect(sorted).toHaveLength(3);
		expect(sorted[0]).toBe(root);
		expect(sorted.indexOf(parent)).toBeGreaterThan(sorted.indexOf(root));
		expect(sorted.indexOf(child)).toBeGreaterThan(sorted.indexOf(parent));
	});
});

