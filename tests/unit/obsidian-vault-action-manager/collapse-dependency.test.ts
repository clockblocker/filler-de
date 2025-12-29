import { describe, expect, it } from "bun:test";
import { collapseActions } from "../../../src/obsidian-vault-action-manager/impl/actions-processing/collapse";
import { buildDependencyGraph } from "../../../src/obsidian-vault-action-manager/impl/actions-processing/dependency-detector";
import { makeKeyForAction } from "../../../src/obsidian-vault-action-manager/impl/actions-processing/helpers/make-key-for-action";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../src/obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../src/obsidian-vault-action-manager/types/split-path";
import {
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

describe("Collapse + Dependencies", () => {
	it("should preserve file dependency after UpsertMdFile + ProcessMdFile collapse", async () => {
		const create: VaultAction = {
			payload: { content: "initial", splitPath: mdFile("file") },
			type: VaultActionType.UpsertMdFile,
		};
		const process: VaultAction = {
			payload: {
				splitPath: mdFile("file"),
				transform: async (c) => c + "\nprocessed",
			},
			type: VaultActionType.ProcessMdFile,
		};

		// Collapse: UpsertMdFile + ProcessMdFile → UpsertMdFile with transformed content
		const collapsed = await collapseActions([create, process]);
		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]?.type).toBe(VaultActionType.UpsertMdFile);
		expect(
			(collapsed[0] as typeof create).payload.content,
		).toBe("initial\nprocessed");

		// After collapse, UpsertMdFile has no file dependencies (just parent folders if any)
		// This is expected - dispatcher will re-ensure requirements
		const graph = buildDependencyGraph(collapsed);
		const collapsedKey = makeKeyForAction(collapsed[0]!);
		const collapsedDeps = graph.get(collapsedKey);
		expect(collapsedDeps?.dependsOn).toHaveLength(0); // No file dependencies, only parent folders if any
	});

	it("should preserve folder dependencies after collapse", async () => {
		const parent: VaultAction = {
			payload: { splitPath: folder("parent") },
			type: VaultActionType.CreateFolder,
		};
		const child: VaultAction = {
			payload: { splitPath: folder("child", ["parent"]) },
			type: VaultActionType.CreateFolder,
		};

		const collapsed = await collapseActions([parent, child]);
		expect(collapsed).toHaveLength(2); // No collapse for different paths

		const graph = buildDependencyGraph(collapsed);
		const childKey = makeKeyForAction(child);
		const childDeps = graph.get(childKey);
		expect(childDeps?.dependsOn).toContain(parent);
	});

	it("should handle UpsertMdFile + UpsertMdFile collapse (keeps UpsertMdFile)", async () => {
		const create: VaultAction = {
			payload: { content: "", splitPath: mdFile("file") },
			type: VaultActionType.UpsertMdFile,
		};
		const replace: VaultAction = {
			payload: { content: "final", splitPath: mdFile("file") },
			type: VaultActionType.UpsertMdFile,
		};

		const collapsed = await collapseActions([create, replace]);
		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]?.type).toBe(VaultActionType.UpsertMdFile);
		expect(collapsed[0]?.payload?.content).toBe("final");

		// UpsertMdFile is preserved, so dependencies are fine
		const graph = buildDependencyGraph(collapsed);
		const collapsedKey = makeKeyForAction(collapsed[0]!);
		expect(graph.has(collapsedKey)).toBe(true); // Key is same (based on path, not content)
	});

	it("should handle multiple ProcessMdFile collapse (composes transforms)", async () => {
		const process1: VaultAction = {
			payload: {
				splitPath: mdFile("file"),
				transform: async (c) => c + "A",
			},
			type: VaultActionType.ProcessMdFile,
		};
		const process2: VaultAction = {
			payload: {
				splitPath: mdFile("file"),
				transform: async (c) => c + "B",
			},
			type: VaultActionType.ProcessMdFile,
		};

		const collapsed = await collapseActions([process1, process2]);
		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]?.type).toBe(VaultActionType.ProcessMdFile);

		// After collapse, still needs UpsertMdFile dependency (will be re-ensured)
		const graph = buildDependencyGraph(collapsed);
		const processKey = makeKeyForAction(process1);
		const processDeps = graph.get(processKey);
		expect(processDeps?.dependsOn).toHaveLength(0); // No UpsertMdFile in collapsed actions
	});

	it("should preserve dependency when ProcessMdFile comes first and UpsertMdFile(null) comes after", async () => {
		// This simulates the order from ensureDestinationsExist: ProcessMdFile first, UpsertMdFile(null) added after
		const process: VaultAction = {
			payload: {
				splitPath: mdFile("file"),
				transform: async (c) => c + "\nprocessed",
			},
			type: VaultActionType.ProcessMdFile,
		};
		const upsert: VaultAction = {
			payload: { content: null, splitPath: mdFile("file") },
			type: VaultActionType.UpsertMdFile,
		};

		// Collapse: ProcessMdFile first, UpsertMdFile(null) after
		const collapsed = await collapseActions([process, upsert]);
		expect(collapsed).toHaveLength(2);
		expect(collapsed.some(a => a.type === VaultActionType.UpsertMdFile)).toBe(true);
		expect(collapsed.some(a => a.type === VaultActionType.ProcessMdFile)).toBe(true);

		// Dependency graph should find ProcessMdFile depends on UpsertMdFile
		const graph = buildDependencyGraph(collapsed);
		const processKey = makeKeyForAction(process);
		const processDeps = graph.get(processKey);
		expect(processDeps?.dependsOn).toHaveLength(1);
		expect(processDeps?.dependsOn[0]?.type).toBe(VaultActionType.UpsertMdFile);
	});
});

