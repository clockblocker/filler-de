import { describe, expect, it } from "bun:test";
import { buildDependencyGraph } from "../../../src/obsidian-vault-action-manager/impl/dependency-detector";
import type {
	SplitPathToFile,
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

describe("buildDependencyGraph", () => {
	it("should create graph entries for all actions", () => {
		const actions: VaultAction[] = [
			{
				payload: { splitPath: folder("A") },
				type: VaultActionType.CreateFolder,
			},
			{
				payload: { content: "", splitPath: mdFile("file") },
				type: VaultActionType.UpsertMdFile,
			},
		];

		const graph = buildDependencyGraph(actions);

		expect(graph.size).toBe(2);
		expect(graph.has(getActionKey(actions[0]))).toBe(true);
		expect(graph.has(getActionKey(actions[1]))).toBe(true);
	});

	it("should detect ProcessMdFile depends on UpsertMdFile for same file", () => {
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

		const processKey = getActionKey(process);
		const processDeps = graph.get(processKey);
		expect(processDeps?.dependsOn).toHaveLength(1);
		expect(processDeps?.dependsOn[0]).toBe(create);

		const createKey = getActionKey(create);
		const createDeps = graph.get(createKey);
		expect(createDeps?.requiredBy).toContain(process);
	});

	it("should detect ReplaceContentMdFile depends on UpsertMdFile for same file", () => {
		const create: VaultAction = {
			payload: { content: "", splitPath: mdFile("file") },
			type: VaultActionType.UpsertMdFile,
		};
		const replace: VaultAction = {
			payload: { content: "new", splitPath: mdFile("file") },
			type: VaultActionType.ReplaceContentMdFile,
		};

		const graph = buildDependencyGraph([create, replace]);

		const replaceKey = getActionKey(replace);
		const replaceDeps = graph.get(replaceKey);
		expect(replaceDeps?.dependsOn).toContain(create);
	});

	it("should detect CreateFolder depends on parent CreateFolder", () => {
		const parent: VaultAction = {
			payload: { splitPath: folder("parent") },
			type: VaultActionType.CreateFolder,
		};
		const child: VaultAction = {
			payload: { splitPath: folder("child", ["parent"]) },
			type: VaultActionType.CreateFolder,
		};

		const graph = buildDependencyGraph([parent, child]);

		const childKey = getActionKey(child);
		const childDeps = graph.get(childKey);
		expect(childDeps?.dependsOn).toContain(parent);
	});

	it("should detect nested folder dependencies", () => {
		const root: VaultAction = {
			payload: { splitPath: folder("root") },
			type: VaultActionType.CreateFolder,
		};
		const mid: VaultAction = {
			payload: { splitPath: folder("mid", ["root"]) },
			type: VaultActionType.CreateFolder,
		};
		const leaf: VaultAction = {
			payload: { splitPath: folder("leaf", ["root", "mid"]) },
			type: VaultActionType.CreateFolder,
		};

		const graph = buildDependencyGraph([root, mid, leaf]);

		const midKey = getActionKey(mid);
		const midDeps = graph.get(midKey);
		expect(midDeps?.dependsOn).toContain(root);

		const leafKey = getActionKey(leaf);
		const leafDeps = graph.get(leafKey);
		expect(leafDeps?.dependsOn).toContain(root);
		expect(leafDeps?.dependsOn).toContain(mid);
	});

	it("should detect RenameMdFile depends on destination parent folders", () => {
		const destParent: VaultAction = {
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

		const graph = buildDependencyGraph([destParent, rename]);

		const renameKey = getActionKey(rename);
		const renameDeps = graph.get(renameKey);
		expect(renameDeps?.dependsOn).toContain(destParent);
	});

	it("should detect UpsertMdFile depends on parent folders", () => {
		const parent: VaultAction = {
			payload: { splitPath: folder("parent") },
			type: VaultActionType.CreateFolder,
		};
		const create: VaultAction = {
			payload: { content: "", splitPath: mdFile("file", ["parent"]) },
			type: VaultActionType.UpsertMdFile,
		};

		const graph = buildDependencyGraph([parent, create]);

		const createKey = getActionKey(create);
		const createDeps = graph.get(createKey);
		expect(createDeps?.dependsOn).toContain(parent);
	});

	it("should not create dependencies for Trash actions", () => {
		const trash: VaultAction = {
			payload: { splitPath: mdFile("file") },
			type: VaultActionType.TrashMdFile,
		};

		const graph = buildDependencyGraph([trash]);

		const trashKey = getActionKey(trash);
		const trashDeps = graph.get(trashKey);
		expect(trashDeps?.dependsOn).toHaveLength(0);
		expect(trashDeps?.requiredBy).toHaveLength(0);
	});

	it("should handle actions with no dependencies", () => {
		const create: VaultAction = {
			payload: { splitPath: folder("root") },
			type: VaultActionType.CreateFolder,
		};

		const graph = buildDependencyGraph([create]);

		const createKey = getActionKey(create);
		const createDeps = graph.get(createKey);
		expect(createDeps?.dependsOn).toHaveLength(0);
	});

	it("should handle complex scenario with multiple dependencies", () => {
		const rootFolder: VaultAction = {
			payload: { splitPath: folder("root") },
			type: VaultActionType.CreateFolder,
		};
		const subFolder: VaultAction = {
			payload: { splitPath: folder("sub", ["root"]) },
			type: VaultActionType.CreateFolder,
		};
		const createFile: VaultAction = {
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

		const graph = buildDependencyGraph([
			rootFolder,
			subFolder,
			createFile,
			process,
		]);

		// subFolder depends on rootFolder
		const subKey = getActionKey(subFolder);
		expect(graph.get(subKey)?.dependsOn).toContain(rootFolder);

		// createFile depends on rootFolder and subFolder
		const createKey = getActionKey(createFile);
		const createDeps = graph.get(createKey);
		expect(createDeps?.dependsOn).toContain(rootFolder);
		expect(createDeps?.dependsOn).toContain(subFolder);

		// process depends on createFile, rootFolder, and subFolder
		const processKey = getActionKey(process);
		const processDeps = graph.get(processKey);
		expect(processDeps?.dependsOn).toContain(createFile);
		expect(processDeps?.dependsOn).toContain(rootFolder);
		expect(processDeps?.dependsOn).toContain(subFolder);
	});

	it("should detect ProcessMdFile depends on UpsertMdFile with null content (EnsureExist)", () => {
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

		const processKey = getActionKey(process);
		const processDeps = graph.get(processKey);
		expect(processDeps?.dependsOn).toContain(ensureExist);
	});

	it("should detect ReplaceContentMdFile depends on UpsertMdFile with null content (EnsureExist)", () => {
		const ensureExist: VaultAction = {
			payload: { content: null, splitPath: mdFile("file") },
			type: VaultActionType.UpsertMdFile,
		};
		const replace: VaultAction = {
			payload: { content: "new", splitPath: mdFile("file") },
			type: VaultActionType.ReplaceContentMdFile,
		};

		const graph = buildDependencyGraph([ensureExist, replace]);

		const replaceKey = getActionKey(replace);
		const replaceDeps = graph.get(replaceKey);
		expect(replaceDeps?.dependsOn).toContain(ensureExist);
	});

	it("should detect UpsertMdFile with null content depends on parent folders", () => {
		const parent: VaultAction = {
			payload: { splitPath: folder("parent") },
			type: VaultActionType.CreateFolder,
		};
		const ensureExist: VaultAction = {
			payload: { content: null, splitPath: mdFile("file", ["parent"]) },
			type: VaultActionType.UpsertMdFile,
		};

		const graph = buildDependencyGraph([parent, ensureExist]);

		const ensureKey = getActionKey(ensureExist);
		const ensureDeps = graph.get(ensureKey);
		expect(ensureDeps?.dependsOn).toContain(parent);
	});
});

