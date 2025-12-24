import { describe, expect, it } from "bun:test";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../src/obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../src/obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../src/obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../src/obsidian-vault-action-manager/types/vault-action";
import type { ExistenceChecker } from "../../../src/obsidian-vault-action-manager/impl/dispatcher";
import {
	buildEnsureExistKeys,
	buildParentFolderKeys,
	collectRequirements,
	collectTrashPaths,
	ensureDestinationsExist,
	getDestinationsToCheck,
	hasActionForKey,
} from "../../../src/obsidian-vault-action-manager/impl/ensure-requirements-helpers";

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

describe("collectTrashPaths", () => {
	it("collects trash folder paths", () => {
		const actions: VaultAction[] = [
			{
				type: VaultActionType.TrashFolder,
				payload: { splitPath: folder("a", ["root"]) },
			},
			{
				type: VaultActionType.TrashFolder,
				payload: { splitPath: folder("b", ["root"]) },
			},
		];

		const result = collectTrashPaths(actions);

		expect(result.folderKeys.size).toBe(2);
		expect(result.folderKeys.has("root/a")).toBe(true);
		expect(result.folderKeys.has("root/b")).toBe(true);
		expect(result.fileKeys.size).toBe(0);
	});

	it("collects trash file paths", () => {
		const actions: VaultAction[] = [
			{
				type: VaultActionType.TrashMdFile,
				payload: { splitPath: mdFile("file1", ["root"]) },
			},
			{
				type: VaultActionType.TrashFile,
				payload: { splitPath: { basename: "file2", extension: "txt", pathParts: ["root"], type: "File" } },
			},
		];

		const result = collectTrashPaths(actions);

		expect(result.fileKeys.size).toBe(2);
		expect(result.fileKeys.has("root/file1.md")).toBe(true);
		expect(result.fileKeys.has("root/file2.txt")).toBe(true);
		expect(result.folderKeys.size).toBe(0);
	});

	it("ignores non-trash actions", () => {
		const actions: VaultAction[] = [
			{
				type: VaultActionType.CreateFolder,
				payload: { splitPath: folder("a", ["root"]) },
			},
			{
				type: VaultActionType.UpsertMdFile,
				payload: { splitPath: mdFile("file", ["root"]) },
			},
		];

		const result = collectTrashPaths(actions);

		expect(result.folderKeys.size).toBe(0);
		expect(result.fileKeys.size).toBe(0);
	});
});

describe("collectRequirements", () => {
	it("collects parent folder keys from CreateFolder", () => {
		const actions: VaultAction[] = [
			{
				type: VaultActionType.CreateFolder,
				payload: { splitPath: folder("child", ["root", "parent"]) },
			},
		];

		const result = collectRequirements(actions);

		expect(result.folderKeys.has("root")).toBe(true);
		expect(result.folderKeys.has("root/parent")).toBe(true);
		expect(result.fileKeys.size).toBe(0);
	});

	it("collects file keys from ProcessMdFile", () => {
		const actions: VaultAction[] = [
			{
				type: VaultActionType.ProcessMdFile,
				payload: {
					splitPath: mdFile("file", ["root", "notes"]),
					transform: (c) => c,
				},
			},
		];

		const result = collectRequirements(actions);

		expect(result.fileKeys.has("root/notes/file.md")).toBe(true);
		expect(result.folderKeys.has("root")).toBe(true);
		expect(result.folderKeys.has("root/notes")).toBe(true);
	});

	it("collects parent folders from RenameFolder destination", () => {
		const actions: VaultAction[] = [
			{
				type: VaultActionType.RenameFolder,
				payload: {
					from: folder("old", ["root"]),
					to: folder("new", ["root", "target"]),
				},
			},
		];

		const result = collectRequirements(actions);

		expect(result.folderKeys.has("root")).toBe(true);
		expect(result.folderKeys.has("root/target")).toBe(true);
		expect(result.fileKeys.size).toBe(0);
	});
});

describe("buildParentFolderKeys", () => {
	it("builds parent folder keys for nested path", () => {
		const splitPath = folder("child", ["root", "parent"]);

		const result = buildParentFolderKeys(splitPath);

		expect(result).toEqual(["root", "root/parent"]);
	});

	it("builds single parent for root-level folder", () => {
		const splitPath = folder("folder", ["root"]);

		const result = buildParentFolderKeys(splitPath);

		expect(result).toEqual(["root"]);
	});

	it("returns empty array for root folder", () => {
		const splitPath = folder("root", []);

		const result = buildParentFolderKeys(splitPath);

		expect(result).toEqual([]);
	});
});

describe("buildEnsureExistKeys", () => {
	const pathToSplitPathToFolder = (path: string): SplitPathToFolder | null => {
		const parts = path.split("/");
		if (parts.length === 0) return null;
		return folder(parts[parts.length - 1] ?? "", parts.slice(0, -1));
	};

	const keyToSplitPathToMdFile = (key: string): SplitPathToMdFile | null => {
		const parts = key.split("/");
		if (parts.length === 0) return null;
		const last = parts[parts.length - 1] ?? "";
		if (!last.endsWith(".md")) return null;
		const basename = last.slice(0, -3);
		return mdFile(basename, parts.slice(0, -1));
	};

	it("builds EnsureExist keys recursively for folders", () => {
		const folderKeys = new Set<string>(["root/parent/child"]);
		const fileKeys = new Set<string>();
		const trashFolderKeys = new Set<string>();
		const trashFileKeys = new Set<string>();

		const result = buildEnsureExistKeys(
			folderKeys,
			fileKeys,
			trashFolderKeys,
			trashFileKeys,
			pathToSplitPathToFolder,
			keyToSplitPathToMdFile,
		);

		expect(result.folderKeys.has("root")).toBe(true);
		expect(result.folderKeys.has("root/parent")).toBe(true);
		expect(result.folderKeys.has("root/parent/child")).toBe(true);
		expect(result.fileKeys.size).toBe(0);
	});

	it("filters out keys that conflict with trash", () => {
		const folderKeys = new Set<string>(["root/parent/child"]);
		const fileKeys = new Set<string>();
		const trashFolderKeys = new Set<string>(["root/parent"]);
		const trashFileKeys = new Set<string>();

		const result = buildEnsureExistKeys(
			folderKeys,
			fileKeys,
			trashFolderKeys,
			trashFileKeys,
			pathToSplitPathToFolder,
			keyToSplitPathToMdFile,
		);

		expect(result.folderKeys.has("root")).toBe(true);
		expect(result.folderKeys.has("root/parent")).toBe(false); // Filtered by trash
		// Note: child is not filtered because it's not directly in trash
		// The trash check only filters direct matches, not children
		expect(result.folderKeys.has("root/parent/child")).toBe(true);
	});

	it("builds EnsureExist keys for files with parent folders", () => {
		const folderKeys = new Set<string>();
		const fileKeys = new Set<string>(["root/notes/file.md"]);
		const trashFolderKeys = new Set<string>();
		const trashFileKeys = new Set<string>();

		const result = buildEnsureExistKeys(
			folderKeys,
			fileKeys,
			trashFolderKeys,
			trashFileKeys,
			pathToSplitPathToFolder,
			keyToSplitPathToMdFile,
		);

		expect(result.folderKeys.has("root")).toBe(true);
		expect(result.folderKeys.has("root/notes")).toBe(true);
		expect(result.fileKeys.has("root/notes/file.md")).toBe(true);
	});
});

describe("hasActionForKey", () => {
	it("returns true if CreateFolder exists for folder key", () => {
		const actions: VaultAction[] = [
			{
				type: VaultActionType.CreateFolder,
				payload: { splitPath: folder("a", ["root"]) },
			},
		];

		expect(hasActionForKey(actions, "root/a", "folder")).toBe(true);
		expect(hasActionForKey(actions, "root/b", "folder")).toBe(false);
	});

	it("returns true if UpsertMdFile exists for file key", () => {
		const actions: VaultAction[] = [
			{
				type: VaultActionType.UpsertMdFile,
				payload: { splitPath: mdFile("file", ["root"]) },
			},
		];

		expect(hasActionForKey(actions, "root/file.md", "file")).toBe(true);
		expect(hasActionForKey(actions, "root/other.md", "file")).toBe(false);
	});

	it("returns true if ProcessMdFile exists for file key", () => {
		const actions: VaultAction[] = [
			{
				type: VaultActionType.ProcessMdFile,
				payload: {
					splitPath: mdFile("file", ["root"]),
					transform: (c) => c,
				},
			},
		];

		expect(hasActionForKey(actions, "root/file.md", "file")).toBe(true);
	});
});

describe("getDestinationsToCheck", () => {
	const pathToSplitPathToFolder = (path: string): SplitPathToFolder | null => {
		const parts = path.split("/");
		if (parts.length === 0) return null;
		return folder(parts[parts.length - 1] ?? "", parts.slice(0, -1));
	};

	const keyToSplitPathToMdFile = (key: string): SplitPathToMdFile | null => {
		const parts = key.split("/");
		if (parts.length === 0) return null;
		const last = parts[parts.length - 1] ?? "";
		if (!last.endsWith(".md")) return null;
		const basename = last.slice(0, -3);
		return mdFile(basename, parts.slice(0, -1));
	};

	it("returns destinations for ProcessMdFile action", () => {
		const actions: VaultAction[] = [
			{
				type: VaultActionType.ProcessMdFile,
				payload: {
					splitPath: mdFile("file", ["root", "notes"]),
					transform: (c) => c,
				},
			},
		];

		const result = getDestinationsToCheck(
			actions,
			pathToSplitPathToFolder,
			keyToSplitPathToMdFile,
		);

		expect(result.createFileKeys.has("root/notes/file.md")).toBe(true);
		expect(result.ensureExistFileKeys.has("root/notes/file.md")).toBe(true);
		expect(result.ensureExistFolderKeys.has("root")).toBe(true);
		expect(result.ensureExistFolderKeys.has("root/notes")).toBe(true);
	});

	it("filters out EnsureExist keys that conflict with Trash", () => {
		const actions: VaultAction[] = [
			{
				type: VaultActionType.TrashFolder,
				payload: { splitPath: folder("parent", ["root"]) },
			},
			{
				type: VaultActionType.ProcessMdFile,
				payload: {
					splitPath: mdFile("file", ["root", "parent"]),
					transform: (c) => c,
				},
			},
		];

		const result = getDestinationsToCheck(
			actions,
			pathToSplitPathToFolder,
			keyToSplitPathToMdFile,
		);

		expect(result.ensureExistFolderKeys.has("root/parent")).toBe(false); // Filtered by trash
		// Note: File is not filtered because we only check direct trash matches
		// The file itself is not trashed, only its parent folder
		expect(result.ensureExistFileKeys.has("root/parent/file.md")).toBe(true);
		// But root folder should still be there
		expect(result.ensureExistFolderKeys.has("root")).toBe(true);
	});
});

describe("ensureDestinationsExist", () => {
	const pathToSplitPathToFolder = (path: string): SplitPathToFolder | null => {
		const parts = path.split("/");
		if (parts.length === 0) return null;
		return folder(parts[parts.length - 1] ?? "", parts.slice(0, -1));
	};

	const keyToSplitPathToMdFile = (key: string): SplitPathToMdFile | null => {
		const parts = key.split("/");
		if (parts.length === 0) return null;
		const last = parts[parts.length - 1] ?? "";
		if (!last.endsWith(".md")) return null;
		const basename = last.slice(0, -3);
		return mdFile(basename, parts.slice(0, -1));
	};

	it("adds EnsureExist actions for non-existing folders", async () => {
		const destinations = {
			ensureExistFolderKeys: new Set<string>(["root/parent"]),
			ensureExistFileKeys: new Set<string>(),
			createFolderKeys: new Set<string>(),
			createFileKeys: new Set<string>(),
		};

		const existenceChecker: ExistenceChecker = {
			exists: async () => false, // Doesn't exist
		};

		const result = await ensureDestinationsExist(
			destinations,
			existenceChecker,
			pathToSplitPathToFolder,
			keyToSplitPathToMdFile,
			[],
		);

		expect(result.length).toBe(1);
		expect(result[0]?.type).toBe(VaultActionType.CreateFolder);
		if (result[0]?.type === VaultActionType.CreateFolder) {
			expect(result[0].payload.splitPath.basename).toBe("parent");
		}
	});

	it("skips EnsureExist actions for existing folders", async () => {
		const destinations = {
			ensureExistFolderKeys: new Set<string>(["root/parent"]),
			ensureExistFileKeys: new Set<string>(),
			createFolderKeys: new Set<string>(),
			createFileKeys: new Set<string>(),
		};

		const existenceChecker: ExistenceChecker = {
			exists: async () => true, // Exists
		};

		const result = await ensureDestinationsExist(
			destinations,
			existenceChecker,
			pathToSplitPathToFolder,
			keyToSplitPathToMdFile,
			[],
		);

		expect(result.length).toBe(0);
	});

	it("adds EnsureExist actions for non-existing files with null content", async () => {
		const destinations = {
			ensureExistFolderKeys: new Set<string>(),
			ensureExistFileKeys: new Set<string>(["root/file.md"]),
			createFolderKeys: new Set<string>(),
			createFileKeys: new Set<string>(),
		};

		const existenceChecker: ExistenceChecker = {
			exists: async () => false, // Doesn't exist
		};

		const result = await ensureDestinationsExist(
			destinations,
			existenceChecker,
			pathToSplitPathToFolder,
			keyToSplitPathToMdFile,
			[],
		);

		expect(result.length).toBe(1);
		expect(result[0]?.type).toBe(VaultActionType.UpsertMdFile);
		if (result[0]?.type === VaultActionType.UpsertMdFile) {
			expect(result[0].payload.content).toBe(null);
		}
	});

	it("skips actions that already exist in batch", async () => {
		const destinations = {
			ensureExistFolderKeys: new Set<string>(["root/parent"]),
			ensureExistFileKeys: new Set<string>(),
			createFolderKeys: new Set<string>(),
			createFileKeys: new Set<string>(),
		};

		const existingActions: VaultAction[] = [
			{
				type: VaultActionType.CreateFolder,
				payload: { splitPath: folder("parent", ["root"]) },
			},
		];

		const existenceChecker: ExistenceChecker = {
			exists: async () => false,
		};

		const result = await ensureDestinationsExist(
			destinations,
			existenceChecker,
			pathToSplitPathToFolder,
			keyToSplitPathToMdFile,
			existingActions,
		);

		expect(result.length).toBe(0); // Already in batch
	});

	it("caches existence checks to avoid redundant calls", async () => {
		const destinations = {
			ensureExistFolderKeys: new Set<string>(["root/parent", "root/other"]),
			ensureExistFileKeys: new Set<string>(),
			createFolderKeys: new Set<string>(["root/parent"]), // Same key
			createFileKeys: new Set<string>(),
		};

		let callCount = 0;
		const existenceChecker: ExistenceChecker = {
			exists: async () => {
				callCount++;
				return false;
			},
		};

		await ensureDestinationsExist(
			destinations,
			existenceChecker,
			pathToSplitPathToFolder,
			keyToSplitPathToMdFile,
			[],
		);

		// Should only check once per unique key (not twice for "root/parent")
		expect(callCount).toBe(2); // "root/parent" and "root/other"
	});

	it("adds CreateFolder actions for non-existing folders", async () => {
		const destinations = {
			ensureExistFolderKeys: new Set<string>(),
			ensureExistFileKeys: new Set<string>(),
			createFolderKeys: new Set<string>(["root/parent"]),
			createFileKeys: new Set<string>(),
		};

		const existenceChecker: ExistenceChecker = {
			exists: async () => false,
		};

		const result = await ensureDestinationsExist(
			destinations,
			existenceChecker,
			pathToSplitPathToFolder,
			keyToSplitPathToMdFile,
			[],
		);

		expect(result.length).toBe(1);
		expect(result[0]?.type).toBe(VaultActionType.CreateFolder);
	});

	it("adds UpsertMdFile actions with empty content for non-existing files", async () => {
		const destinations = {
			ensureExistFolderKeys: new Set<string>(),
			ensureExistFileKeys: new Set<string>(),
			createFolderKeys: new Set<string>(),
			createFileKeys: new Set<string>(["root/file.md"]),
		};

		const existenceChecker: ExistenceChecker = {
			exists: async () => false,
		};

		const result = await ensureDestinationsExist(
			destinations,
			existenceChecker,
			pathToSplitPathToFolder,
			keyToSplitPathToMdFile,
			[],
		);

		expect(result.length).toBe(1);
		expect(result[0]?.type).toBe(VaultActionType.UpsertMdFile);
		if (result[0]?.type === VaultActionType.UpsertMdFile) {
			expect(result[0].payload.content).toBe(""); // Empty content for create
		}
	});
});

