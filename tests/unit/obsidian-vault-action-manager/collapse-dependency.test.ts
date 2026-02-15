import { describe, expect, it } from "bun:test";
import { collapseActions } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/collapse";
import { buildDependencyGraph, makeGraphKey } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/dependency-detector";
import { MD } from "../../../src/managers/obsidian/vault-action-manager/types/literals";
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
	extension: MD,
	kind: SplitPathKind.MdFile,
	pathParts,
});

describe("Collapse + Dependencies", () => {
	it("should preserve file dependency after UpsertMdFile + ProcessMdFile collapse", async () => {
		const create: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "initial", splitPath: mdFile("file") },
		};
		const process: VaultAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: mdFile("file"),
				transform: async (c) => c + "\nprocessed",
			},
		};

		// Collapse: UpsertMdFile + ProcessMdFile → UpsertMdFile with transformed content
		const collapsed = await collapseActions([create, process]);
		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]?.kind).toBe(VaultActionKind.UpsertMdFile);
		expect(
			(collapsed[0] as { payload: { content: string } }).payload.content,
		).toBe("initial\nprocessed");

		// After collapse, UpsertMdFile has no file dependencies (just parent folders if any)
		// This is expected - dispatcher will re-ensure requirements
		const graph = buildDependencyGraph(collapsed);
		const collapsedKey = makeGraphKey(collapsed[0]!);
		const collapsedDeps = graph.get(collapsedKey);
		expect(collapsedDeps?.dependsOn).toHaveLength(0); // No file dependencies, only parent folders if any
	});

	it("should preserve folder dependencies after collapse", async () => {
		const parent: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("parent") },
		};
		const child: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("child", ["parent"]) },
		};

		const collapsed = await collapseActions([parent, child]);
		expect(collapsed).toHaveLength(2); // No collapse for different paths

		const graph = buildDependencyGraph(collapsed);
		const childKey = makeGraphKey(child);
		const childDeps = graph.get(childKey);
		expect(childDeps?.dependsOn).toContain(parent);
	});

	it("should handle UpsertMdFile + UpsertMdFile collapse (keeps UpsertMdFile)", async () => {
		const create: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "", splitPath: mdFile("file") },
		};
		const replace: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "final", splitPath: mdFile("file") },
		};

		const collapsed = await collapseActions([create, replace]);
		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]?.kind).toBe(VaultActionKind.UpsertMdFile);
		expect(collapsed[0]?.payload?.content).toBe("final");

		// UpsertMdFile is preserved, so dependencies are fine
		const graph = buildDependencyGraph(collapsed);
		const collapsedKey = makeGraphKey(collapsed[0]!);
		expect(graph.has(collapsedKey)).toBe(true); // Key is same (based on path, not content)
	});

	it("should handle multiple ProcessMdFile collapse (composes transforms)", async () => {
		const process1: VaultAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: mdFile("file"),
				transform: async (c) => c + "A",
			},
		};
		const process2: VaultAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: mdFile("file"),
				transform: async (c) => c + "B",
			},
		};

		const collapsed = await collapseActions([process1, process2]);
		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]?.kind).toBe(VaultActionKind.ProcessMdFile);

		// After collapse, still needs UpsertMdFile dependency (will be re-ensured)
		const graph = buildDependencyGraph(collapsed);
		const processKey = makeGraphKey(process1);
		const processDeps = graph.get(processKey);
		expect(processDeps?.dependsOn).toHaveLength(0); // No UpsertMdFile in collapsed actions
	});

	it("should preserve dependency when ProcessMdFile comes first and UpsertMdFile(null) comes after", async () => {
		// This simulates the order from ensureDestinationsExist: ProcessMdFile first, UpsertMdFile(null) added after
		const process: VaultAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: mdFile("file"),
				transform: async (c) => c + "\nprocessed",
			},
		};
		const upsert: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: null, splitPath: mdFile("file") },
		};

		// Collapse: ProcessMdFile first, UpsertMdFile(null) after
		const collapsed = await collapseActions([process, upsert]);
		expect(collapsed).toHaveLength(2);
		expect(collapsed.some(a => a.kind === VaultActionKind.UpsertMdFile)).toBe(true);
		expect(collapsed.some(a => a.kind === VaultActionKind.ProcessMdFile)).toBe(true);

		// Dependency graph should find ProcessMdFile depends on UpsertMdFile
		const graph = buildDependencyGraph(collapsed);
		const processKey = makeGraphKey(process);
		const processDeps = graph.get(processKey);
		expect(processDeps?.dependsOn).toHaveLength(1);
		expect(processDeps?.dependsOn[0]?.kind).toBe(VaultActionKind.UpsertMdFile);
	});
});

