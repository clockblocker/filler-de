import { describe, expect, it } from "bun:test";
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

describe("buildDependencyGraph", () => {
	it("should create graph entries for all actions", () => {
		const actions: VaultAction[] = [
			{
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("A") },
			},
			{
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "", splitPath: mdFile("file") },
			},
		];

		const graph = buildDependencyGraph(actions);

		expect(graph.size).toBe(2);
		expect(graph.has(makeGraphKey(actions[0]!))).toBe(true);
		expect(graph.has(makeGraphKey(actions[1]!))).toBe(true);
	});

	it("should detect ProcessMdFile depends on UpsertMdFile for same file", () => {
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

		const processKey = makeGraphKey(process);
		const processDeps = graph.get(processKey);
		expect(processDeps?.dependsOn).toHaveLength(1);
		expect(processDeps?.dependsOn[0]).toBe(create);

		const createKey = makeGraphKey(create);
		const createDeps = graph.get(createKey);
		expect(createDeps?.requiredBy).toContain(process);
	});

	it("should not create dependency between UpsertMdFile actions for same file (they collapse)", () => {
		const create: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "", splitPath: mdFile("file") },
		};
		const replace: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "new", splitPath: mdFile("file") },
		};

		const graph = buildDependencyGraph([create, replace]);

		const replaceKey = makeGraphKey(replace);
		const replaceDeps = graph.get(replaceKey);
		// UpsertMdFile actions for same file should collapse, not create dependencies
		// They only depend on parent folders
		expect(replaceDeps?.dependsOn).not.toContain(create);
	});

	it("should detect CreateFolder depends on parent CreateFolder", () => {
		const parent: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("parent") },
		};
		const child: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("child", ["parent"]) },
		};

		const graph = buildDependencyGraph([parent, child]);

		const childKey = makeGraphKey(child);
		const childDeps = graph.get(childKey);
		expect(childDeps?.dependsOn).toContain(parent);
	});

	it("should detect nested folder dependencies", () => {
		const root: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("root") },
		};
		const mid: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("mid", ["root"]) },
		};
		const leaf: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("leaf", ["root", "mid"]) },
		};

		const graph = buildDependencyGraph([root, mid, leaf]);

		const midKey = makeGraphKey(mid);
		const midDeps = graph.get(midKey);
		expect(midDeps?.dependsOn).toContain(root);

		const leafKey = makeGraphKey(leaf);
		const leafDeps = graph.get(leafKey);
		expect(leafDeps?.dependsOn).toContain(root);
		expect(leafDeps?.dependsOn).toContain(mid);
	});

	it("should detect RenameMdFile depends on destination parent folders", () => {
		const destParent: VaultAction = {
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

		const graph = buildDependencyGraph([destParent, rename]);

		const renameKey = makeGraphKey(rename);
		const renameDeps = graph.get(renameKey);
		expect(renameDeps?.dependsOn).toContain(destParent);
	});

	it("should detect UpsertMdFile depends on parent folders", () => {
		const parent: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("parent") },
		};
		const create: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "", splitPath: mdFile("file", ["parent"]) },
		};

		const graph = buildDependencyGraph([parent, create]);

		const createKey = makeGraphKey(create);
		const createDeps = graph.get(createKey);
		expect(createDeps?.dependsOn).toContain(parent);
	});

	it("should not create dependencies for Trash actions", () => {
		const trash: VaultAction = {
			kind: VaultActionKind.TrashMdFile,
			payload: { splitPath: mdFile("file") },
		};

		const graph = buildDependencyGraph([trash]);

		const trashKey = makeGraphKey(trash);
		const trashDeps = graph.get(trashKey);
		expect(trashDeps?.dependsOn).toHaveLength(0);
		expect(trashDeps?.requiredBy).toHaveLength(0);
	});

	it("should handle actions with no dependencies", () => {
		const create: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("root") },
		};

		const graph = buildDependencyGraph([create]);

		const createKey = makeGraphKey(create);
		const createDeps = graph.get(createKey);
		expect(createDeps?.dependsOn).toHaveLength(0);
	});

	it("should handle complex scenario with multiple dependencies", () => {
		const rootFolder: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("root") },
		};
		const subFolder: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("sub", ["root"]) },
		};
		const createFile: VaultAction = {
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

		const graph = buildDependencyGraph([
			rootFolder,
			subFolder,
			createFile,
			process,
		]);

		// subFolder depends on rootFolder
		const subKey = makeGraphKey(subFolder);
		expect(graph.get(subKey)?.dependsOn).toContain(rootFolder);

		// createFile depends on rootFolder and subFolder
		const createKey = makeGraphKey(createFile);
		const createDeps = graph.get(createKey);
		expect(createDeps?.dependsOn).toContain(rootFolder);
		expect(createDeps?.dependsOn).toContain(subFolder);

		// process depends on createFile, rootFolder, and subFolder
		const processKey = makeGraphKey(process);
		const processDeps = graph.get(processKey);
		expect(processDeps?.dependsOn).toContain(createFile);
		expect(processDeps?.dependsOn).toContain(rootFolder);
		expect(processDeps?.dependsOn).toContain(subFolder);
	});

	it("should detect ProcessMdFile depends on UpsertMdFile with null content (EnsureExist)", () => {
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

		const processKey = makeGraphKey(process);
		const processDeps = graph.get(processKey);
		expect(processDeps?.dependsOn).toContain(ensureExist);
	});

	it("should not create dependency between UpsertMdFile(null) and UpsertMdFile(content) (they collapse)", () => {
		const ensureExist: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: null, splitPath: mdFile("file") },
		};
		const replace: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "new", splitPath: mdFile("file") },
		};

		const graph = buildDependencyGraph([ensureExist, replace]);

		const replaceKey = makeGraphKey(replace);
		const replaceDeps = graph.get(replaceKey);
		// UpsertMdFile actions for same file should collapse, not create dependencies
		// They only depend on parent folders
		expect(replaceDeps?.dependsOn).not.toContain(ensureExist);
	});

	it("should detect UpsertMdFile with null content depends on parent folders", () => {
		const parent: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("parent") },
		};
		const ensureExist: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: null, splitPath: mdFile("file", ["parent"]) },
		};

		const graph = buildDependencyGraph([parent, ensureExist]);

		const ensureKey = makeGraphKey(ensureExist);
		const ensureDeps = graph.get(ensureKey);
		expect(ensureDeps?.dependsOn).toContain(parent);
	});
});

