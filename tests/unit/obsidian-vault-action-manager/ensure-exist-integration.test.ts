import { describe, expect, it } from "bun:test";
import { collapseActions } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/collapse";
import { buildDependencyGraph, makeGraphKey } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/dependency-detector";
import { topologicalSort } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/topological-sort";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathType } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type { VaultAction } from "../../../src/managers/obsidian/vault-action-manager/types/vault-action";
import {
	VaultActionType,
} from "../../../src/managers/obsidian/vault-action-manager/types/vault-action";

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

describe("EnsureExist Integration", () => {
	it("should ensure parent folders exist before files (recursive)", () => {
		// ProcessMdFile on nested file should require parent folders
		const process: VaultAction = {
			payload: {
				splitPath: mdFile("file", ["root", "parent", "child"]),
				transform: async (c) => c,
			},
			type: VaultActionType.ProcessMdFile,
		};

		// EnsureExist actions would be added by dispatcher
		const rootFolder: VaultAction = {
			payload: { splitPath: folder("root") },
			type: VaultActionType.CreateFolder,
		};
		const parentFolder: VaultAction = {
			payload: { splitPath: folder("parent", ["root"]) },
			type: VaultActionType.CreateFolder,
		};
		const childFolder: VaultAction = {
			payload: { splitPath: folder("child", ["root", "parent"]) },
			type: VaultActionType.CreateFolder,
		};
		const ensureFile: VaultAction = {
			payload: { content: null, splitPath: mdFile("file", ["root", "parent", "child"]) },
			type: VaultActionType.UpsertMdFile,
		};

		const graph = buildDependencyGraph([
			rootFolder,
			parentFolder,
			childFolder,
			ensureFile,
			process,
		]);

		// Verify dependencies
		const processKey = makeGraphKey(process);
		const processDeps = graph.get(processKey);
		expect(processDeps?.dependsOn).toContain(ensureFile);
		expect(processDeps?.dependsOn).toContain(childFolder);
		expect(processDeps?.dependsOn).toContain(parentFolder);
		expect(processDeps?.dependsOn).toContain(rootFolder);
	});

	it("should collapse EnsureExist + Create to Create", async () => {
		const ensureExist: VaultAction = {
			payload: { content: null, splitPath: mdFile("file") },
			type: VaultActionType.UpsertMdFile,
		};
		const create: VaultAction = {
			payload: { content: "content", splitPath: mdFile("file") },
			type: VaultActionType.UpsertMdFile,
		};

		const collapsed = await collapseActions([ensureExist, create]);

		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]?.type).toBe(VaultActionType.UpsertMdFile);
		if (collapsed[0]?.type === VaultActionType.UpsertMdFile) {
			expect(collapsed[0].payload.content).toBe("content");
		}
	});

	it("should sort EnsureExist before mutator actions", async () => {
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
		const replace: VaultAction = {
			payload: { content: "new", splitPath: mdFile("file") },
			type: VaultActionType.UpsertMdFile,
		};

		// Collapse first: UpsertMdFile(null) + ProcessMdFile → both kept,
		// then UpsertMdFile(content) replaces UpsertMdFile(null) and removes ProcessMdFile
		const collapsed = await collapseActions([ensureExist, process, replace]);
		// After collapse: only UpsertMdFile(content) remains
		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]?.type).toBe(VaultActionType.UpsertMdFile);
		expect((collapsed[0]! as typeof replace).payload.content).toBe("new");

		// Build dependency graph on collapsed actions
		const graph = buildDependencyGraph(collapsed);
		const sorted = topologicalSort(collapsed, graph);

		// After collapse, only UpsertMdFile(content) remains
		expect(sorted).toHaveLength(1);
		expect(sorted[0]?.type).toBe(VaultActionType.UpsertMdFile);
	});

	it("should handle complex scenario: EnsureExist + Create + Process", async () => {
		const rootFolder: VaultAction = {
			payload: { splitPath: folder("root") },
			type: VaultActionType.CreateFolder,
		};
		const ensureFile: VaultAction = {
			payload: { content: null, splitPath: mdFile("file", ["root"]) },
			type: VaultActionType.UpsertMdFile,
		};
		const createFile: VaultAction = {
			payload: { content: "initial", splitPath: mdFile("file", ["root"]) },
			type: VaultActionType.UpsertMdFile,
		};
		const process: VaultAction = {
			payload: {
				splitPath: mdFile("file", ["root"]),
				transform: async (c) => c + "\nprocessed",
			},
			type: VaultActionType.ProcessMdFile,
		};

		// Collapse: EnsureExist + Create → Create
		const collapsed = await collapseActions([ensureFile, createFile]);
		expect(collapsed).toHaveLength(1);

		// Sort: rootFolder → createFile → process
		const allActions = [rootFolder, ...collapsed, process];
		const graph = buildDependencyGraph(allActions);
		const sorted = topologicalSort(allActions, graph);

		expect(sorted[0]).toBe(rootFolder);
		expect(sorted.indexOf(process)).toBeGreaterThan(sorted.indexOf(collapsed[0]!));
	});
});

