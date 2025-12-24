import { describe, expect, it } from "bun:test";
import { collapseActions } from "../../../src/obsidian-vault-action-manager/impl/collapse";
import { buildDependencyGraph } from "../../../src/obsidian-vault-action-manager/impl/dependency-detector";
import { topologicalSort } from "../../../src/obsidian-vault-action-manager/impl/topological-sort";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../src/obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../src/obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../src/obsidian-vault-action-manager/types/vault-action";
import {
	getActionKey,
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
		const processKey = getActionKey(process);
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

	it("should sort EnsureExist before mutator actions", () => {
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
			type: VaultActionType.ReplaceContentMdFile,
		};

		const graph = buildDependencyGraph([ensureExist, process, replace]);
		const sorted = topologicalSort([ensureExist, process, replace], graph);

		// EnsureExist should come first
		expect(sorted[0]).toBe(ensureExist);
		// Process and Replace should come after (order between them doesn't matter)
		expect(sorted.indexOf(process)).toBeGreaterThan(0);
		expect(sorted.indexOf(replace)).toBeGreaterThan(0);
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

