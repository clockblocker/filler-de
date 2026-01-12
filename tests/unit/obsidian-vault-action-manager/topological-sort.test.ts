import { describe, expect, it } from "bun:test";
import { buildDependencyGraph, makeGraphKey } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/dependency-detector";
import {  } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/helpers/make-key-for-action";
import { topologicalSort } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/topological-sort";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../src/managers/obsidian/vault-action-manager/types/vault-action";

const folder = (
	basename: string,
	pathParts: string[] = [],
): SplitPathToFolder => ({
	basename,
	kind: SplitPathKind.Folder,
	pathParts,
});

const mdFile = (
	basename: string,
	pathParts: string[] = [],
): SplitPathToMdFile => ({
	basename,
	extension: "md",
	kind: SplitPathKind.MdFile,
	pathParts,
});

describe("topologicalSort", () => {
	it("should return empty array for empty actions", () => {
		const graph = buildDependencyGraph([]);
		const sorted = topologicalSort([], graph);
		expect(sorted).toEqual([]);
	});

	it("should sort actions with no dependencies", () => {
		const action1: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("A") },
		};
		const action2: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("B") },
		};

		const graph = buildDependencyGraph([action1, action2]);
		const sorted = topologicalSort([action1, action2], graph);

		expect(sorted).toHaveLength(2);
		expect(sorted).toContain(action1);
		expect(sorted).toContain(action2);
	});

	it("should respect dependency: UpsertMdFile before ProcessMdFile", () => {
		const create: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "", splitPath: mdFile("file") },
		};
		const process: VaultAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: mdFile("file"),
				transform: async (c) => c,
			},
		};

		const graph = buildDependencyGraph([create, process]);
		const sorted = topologicalSort([create, process], graph);

		expect(sorted).toHaveLength(2);
		expect(sorted[0]).toBe(create);
		expect(sorted[1]).toBe(process);
	});

	it("should respect dependency: parent folder before child folder", () => {
		const parent: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("parent") },
		};
		const child: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("child", ["parent"]) },
		};

		const graph = buildDependencyGraph([parent, child]);
		const sorted = topologicalSort([parent, child], graph);

		expect(sorted).toHaveLength(2);
		expect(sorted[0]).toBe(parent);
		expect(sorted[1]).toBe(child);
	});

	it("should sort by path depth when no dependencies (shallow first)", () => {
		const deep: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("deep", ["a", "b", "c"]) },
		};
		const shallow: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("shallow", ["a"]) },
		};

		const graph = buildDependencyGraph([deep, shallow]);
		const sorted = topologicalSort([deep, shallow], graph);

		expect(sorted).toHaveLength(2);
		expect(sorted[0]).toBe(shallow); // Shallow first
		expect(sorted[1]).toBe(deep);
	});

	it("should handle complex dependency chain", () => {
		const root: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("root") },
		};
		const sub: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("sub", ["root"]) },
		};
		const create: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "", splitPath: mdFile("file", ["root", "sub"]) },
		};
		const process: VaultAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: mdFile("file", ["root", "sub"]),
				transform: async (c) => c,
			},
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
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("parent") },
		};
		const file1: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "", splitPath: mdFile("file1", ["parent"]) },
		};
		const file2: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "", splitPath: mdFile("file2", ["parent"]) },
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
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("A") },
		};
		const action2: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("B") },
		};

		// Create a graph with a cycle manually (not through buildDependencyGraph)
		const graph = buildDependencyGraph([action1, action2]);
		// Manually create cycle (this shouldn't happen in real usage)
		const key1 = makeGraphKey(action1);
		const key2 = makeGraphKey(action2);
		graph.get(key1)!.dependsOn.push(action2);
		graph.get(key2)!.dependsOn.push(action1);

		expect(() => {
			topologicalSort([action1, action2], graph);
		}).toThrow("Cycle detected");
	});

	it("should handle RenameMdFile dependency on destination folder", () => {
		const destFolder: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("dest") },
		};
		const rename: VaultAction = {
			kind: VaultActionKind.RenameMdFile,
			payload: {
				from: mdFile("file"),
				to: mdFile("file", ["dest"]),
			},
		};

		const graph = buildDependencyGraph([destFolder, rename]);
		const sorted = topologicalSort([destFolder, rename], graph);

		expect(sorted).toHaveLength(2);
		expect(sorted[0]).toBe(destFolder);
		expect(sorted[1]).toBe(rename);
	});

	it("should sort UpsertMdFile(null) before ProcessMdFile (EnsureExist)", () => {
		const ensureExist: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: null, splitPath: mdFile("file") },
		};
		const process: VaultAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: mdFile("file"),
				transform: async (c) => c,
			},
		};

		const graph = buildDependencyGraph([ensureExist, process]);
		const sorted = topologicalSort([ensureExist, process], graph);

		expect(sorted).toHaveLength(2);
		expect(sorted[0]).toBe(ensureExist);
		expect(sorted[1]).toBe(process);
	});

	it("should sort EnsureExist folders recursively (parent before child)", () => {
		const root: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("root") },
		};
		const parent: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("parent", ["root"]) },
		};
		const child: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("child", ["root", "parent"]) },
		};

		const graph = buildDependencyGraph([root, parent, child]);
		const sorted = topologicalSort([root, parent, child], graph);

		expect(sorted).toHaveLength(3);
		expect(sorted[0]).toBe(root);
		expect(sorted.indexOf(parent)).toBeGreaterThan(sorted.indexOf(root));
		expect(sorted.indexOf(child)).toBeGreaterThan(sorted.indexOf(parent));
	});
});

