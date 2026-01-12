import { describe, expect, it } from "bun:test";
import { collapseActions } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/collapse";
import { buildDependencyGraph, makeGraphKey } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/dependency-detector";
import { topologicalSort } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/topological-sort";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type { VaultAction } from "../../../src/managers/obsidian/vault-action-manager/types/vault-action";
import {
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

describe("EnsureExist Integration", () => {
	it("should ensure parent folders exist before files (recursive)", () => {
		// ProcessMdFile on nested file should require parent folders
		const process: VaultAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: mdFile("file", ["root", "parent", "child"]),
				transform: async (c) => c,
			},
		};

		// EnsureExist actions would be added by dispatcher
		const rootFolder: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("root") },
		};
		const parentFolder: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("parent", ["root"]) },
		};
		const childFolder: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("child", ["root", "parent"]) },
		};
		const ensureFile: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: null, splitPath: mdFile("file", ["root", "parent", "child"]) },
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
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: null, splitPath: mdFile("file") },
		};
		const create: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "content", splitPath: mdFile("file") },
		};

		const collapsed = await collapseActions([ensureExist, create]);

		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]?.kind).toBe(VaultActionKind.UpsertMdFile);
		if (collapsed[0]?.kind === VaultActionKind.UpsertMdFile) {
			expect(collapsed[0].payload.content).toBe("content");
		}
	});

	it("should sort EnsureExist before mutator actions", async () => {
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
		const replace: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "new", splitPath: mdFile("file") },
		};

		// Collapse first: UpsertMdFile(null) + ProcessMdFile → both kept,
		// then UpsertMdFile(content) replaces UpsertMdFile(null) and removes ProcessMdFile
		const collapsed = await collapseActions([ensureExist, process, replace]);
		// After collapse: only UpsertMdFile(content) remains
		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]?.kind).toBe(VaultActionKind.UpsertMdFile);
		expect((collapsed[0]! as typeof replace).payload.content).toBe("new");

		// Build dependency graph on collapsed actions
		const graph = buildDependencyGraph(collapsed);
		const sorted = topologicalSort(collapsed, graph);

		// After collapse, only UpsertMdFile(content) remains
		expect(sorted).toHaveLength(1);
		expect(sorted[0]?.kind).toBe(VaultActionKind.UpsertMdFile);
	});

	it("should handle complex scenario: EnsureExist + Create + Process", async () => {
		const rootFolder: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("root") },
		};
		const ensureFile: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: null, splitPath: mdFile("file", ["root"]) },
		};
		const createFile: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "initial", splitPath: mdFile("file", ["root"]) },
		};
		const process: VaultAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: mdFile("file", ["root"]),
				transform: async (c) => c + "\nprocessed",
			},
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

