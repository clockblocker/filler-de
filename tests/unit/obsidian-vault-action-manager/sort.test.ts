import { describe, expect, it } from "bun:test";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../src/obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../src/obsidian-vault-action-manager/types/split-path";
import {
	sortActionsByWeight,
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

const file = (
	basename: string,
	extension: string,
	pathParts: string[] = [],
): SplitPathToFile => ({
	basename,
	extension,
	pathParts,
	type: SplitPathType.File,
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

describe("sortActionsByWeight", () => {
	it("sorts by weight: folders before files before content ops", () => {
		const createFile: VaultAction = {
			payload: { splitPath: file("a.txt", "txt") },
			type: VaultActionType.CreateFile,
		};
		const createFolder: VaultAction = {
			payload: { splitPath: folder("folder") },
			type: VaultActionType.CreateFolder,
		};
		const processMdFile: VaultAction = {
			payload: {
				splitPath: mdFile("b.md"),
				transform: (c) => c,
			},
			type: VaultActionType.ProcessMdFile,
		};

		const sorted = sortActionsByWeight([processMdFile, createFile, createFolder]);
		expect(sorted[0].type).toBe(VaultActionType.CreateFolder);
		expect(sorted[1].type).toBe(VaultActionType.CreateFile);
		expect(sorted[2].type).toBe(VaultActionType.ProcessMdFile);
	});

	it("sorts by path depth within same weight: shallow first", () => {
		const deep: VaultAction = {
			payload: { splitPath: folder("deep", ["a", "b", "c"]) },
			type: VaultActionType.CreateFolder,
		};
		const shallow: VaultAction = {
			payload: { splitPath: folder("shallow", ["a"]) },
			type: VaultActionType.CreateFolder,
		};
		const medium: VaultAction = {
			payload: { splitPath: folder("medium", ["a", "b"]) },
			type: VaultActionType.CreateFolder,
		};

		const sorted = sortActionsByWeight([deep, medium, shallow]);
		expect(sorted[0]).toEqual(shallow);
		expect(sorted[1]).toEqual(medium);
		expect(sorted[2]).toEqual(deep);
	});

	it("sorts folder renames by destination depth", () => {
		const shallow: VaultAction = {
			payload: {
				from: folder("A", ["root"]),
				to: folder("A1", ["root"]),
			},
			type: VaultActionType.RenameFolder,
		};
		const deep: VaultAction = {
			payload: {
				from: folder("B", ["root", "child"]),
				to: folder("B1", ["root", "child", "grandchild"]),
			},
			type: VaultActionType.RenameFolder,
		};

		const sorted = sortActionsByWeight([deep, shallow]);
		expect(sorted[0]).toEqual(shallow);
		expect(sorted[1]).toEqual(deep);
	});

	it("sorts file operations by path depth", () => {
		const deep: VaultAction = {
			payload: { splitPath: file("deep.txt", "txt", ["a", "b", "c"]) },
			type: VaultActionType.CreateFile,
		};
		const shallow: VaultAction = {
			payload: { splitPath: file("shallow.txt", "txt", ["a"]) },
			type: VaultActionType.CreateFile,
		};

		const sorted = sortActionsByWeight([deep, shallow]);
		expect(sorted[0]).toEqual(shallow);
		expect(sorted[1]).toEqual(deep);
	});

	it("sorts mdFile operations by path depth", () => {
		const deep: VaultAction = {
			payload: { splitPath: mdFile("deep.md", ["a", "b", "c"]) },
			type: VaultActionType.CreateMdFile,
		};
		const shallow: VaultAction = {
			payload: { splitPath: mdFile("shallow.md", ["a"]) },
			type: VaultActionType.CreateMdFile,
		};

		const sorted = sortActionsByWeight([deep, shallow]);
		expect(sorted[0]).toEqual(shallow);
		expect(sorted[1]).toEqual(deep);
	});

	it("sorts file renames by destination depth", () => {
		const shallow: VaultAction = {
			payload: {
				from: file("a.txt", "txt", ["root"]),
				to: file("a1.txt", "txt", ["root"]),
			},
			type: VaultActionType.RenameFile,
		};
		const deep: VaultAction = {
			payload: {
				from: file("b.txt", "txt", ["root", "child"]),
				to: file("b1.txt", "txt", ["root", "child", "deep"]),
			},
			type: VaultActionType.RenameFile,
		};

		const sorted = sortActionsByWeight([deep, shallow]);
		expect(sorted[0]).toEqual(shallow);
		expect(sorted[1]).toEqual(deep);
	});

	it("sorts mdFile renames by destination depth", () => {
		const shallow: VaultAction = {
			payload: {
				from: mdFile("a.md", ["root"]),
				to: mdFile("a1.md", ["root"]),
			},
			type: VaultActionType.RenameMdFile,
		};
		const deep: VaultAction = {
			payload: {
				from: mdFile("b.md", ["root", "child"]),
				to: mdFile("b1.md", ["root", "child", "deep"]),
			},
			type: VaultActionType.RenameMdFile,
		};

		const sorted = sortActionsByWeight([deep, shallow]);
		expect(sorted[0]).toEqual(shallow);
		expect(sorted[1]).toEqual(deep);
	});

	it("sorts content operations by path depth", () => {
		const deep: VaultAction = {
			payload: {
				splitPath: mdFile("deep.md", ["a", "b", "c"]),
				transform: (c) => c,
			},
			type: VaultActionType.ProcessMdFile,
		};
		const shallow: VaultAction = {
			payload: {
				splitPath: mdFile("shallow.md", ["a"]),
				transform: (c) => c,
			},
			type: VaultActionType.ProcessMdFile,
		};

		const sorted = sortActionsByWeight([deep, shallow]);
		expect(sorted[0]).toEqual(shallow);
		expect(sorted[1]).toEqual(deep);
	});

	it("sorts replace content by path depth", () => {
		const deep: VaultAction = {
			payload: {
				content: "content",
				splitPath: mdFile("deep.md", ["a", "b", "c"]),
			},
			type: VaultActionType.ReplaceContentMdFile,
		};
		const shallow: VaultAction = {
			payload: {
				content: "content",
				splitPath: mdFile("shallow.md", ["a"]),
			},
			type: VaultActionType.ReplaceContentMdFile,
		};

		const sorted = sortActionsByWeight([deep, shallow]);
		expect(sorted[0]).toEqual(shallow);
		expect(sorted[1]).toEqual(deep);
	});

	it("handles mixed weights and depths correctly", () => {
		const actions: VaultAction[] = [
			{
				payload: { splitPath: mdFile("deep.md", ["a", "b", "c"]) },
				type: VaultActionType.CreateMdFile,
			},
			{
				payload: { splitPath: folder("deep-folder", ["x", "y", "z"]) },
				type: VaultActionType.CreateFolder,
			},
			{
				payload: { splitPath: folder("shallow-folder", ["x"]) },
				type: VaultActionType.CreateFolder,
			},
			{
				payload: {
					splitPath: mdFile("shallow.md", ["a"]),
					transform: (c) => c,
				},
				type: VaultActionType.ProcessMdFile,
			},
			{
				payload: { splitPath: file("medium.txt", "txt", ["a", "b"]) },
				type: VaultActionType.CreateFile,
			},
		];

		const sorted = sortActionsByWeight(actions);
		expect(sorted[0].type).toBe(VaultActionType.CreateFolder);
		expect((sorted[0] as typeof actions[2]).payload.splitPath.basename).toBe("shallow-folder");
		expect(sorted[1].type).toBe(VaultActionType.CreateFolder);
		expect((sorted[1] as typeof actions[1]).payload.splitPath.basename).toBe("deep-folder");
		expect(sorted[2].type).toBe(VaultActionType.CreateFile);
		expect(sorted[3].type).toBe(VaultActionType.CreateMdFile);
		expect(sorted[4].type).toBe(VaultActionType.ProcessMdFile);
	});

	it("handles empty array", () => {
		const sorted = sortActionsByWeight([]);
		expect(sorted).toEqual([]);
	});

	it("handles single action", () => {
		const action: VaultAction = {
			payload: { splitPath: folder("test") },
			type: VaultActionType.CreateFolder,
		};
		const sorted = sortActionsByWeight([action]);
		expect(sorted).toEqual([action]);
	});

	it("preserves order for actions with same weight and depth", () => {
		const action1: VaultAction = {
			payload: { splitPath: folder("a") },
			type: VaultActionType.CreateFolder,
		};
		const action2: VaultAction = {
			payload: { splitPath: folder("b") },
			type: VaultActionType.CreateFolder,
		};

		const sorted = sortActionsByWeight([action1, action2]);
		expect(sorted[0]).toEqual(action1);
		expect(sorted[1]).toEqual(action2);
	});

	it("sorts all action types in correct weight order", () => {
		const actions: VaultAction[] = [
			{ payload: { splitPath: mdFile("z.md") }, type: VaultActionType.TrashMdFile },
			{ payload: { content: "c", splitPath: mdFile("y.md") }, type: VaultActionType.ReplaceContentMdFile },
			{ payload: { splitPath: file("x.txt", "txt") }, type: VaultActionType.TrashFile },
			{ payload: { from: mdFile("w.md"), to: mdFile("w1.md") }, type: VaultActionType.RenameMdFile },
			{ payload: { from: file("v.txt", "txt"), to: file("v1.txt", "txt") }, type: VaultActionType.RenameFile },
			{ payload: { splitPath: mdFile("u.md") }, type: VaultActionType.CreateMdFile },
			{ payload: { splitPath: file("t.txt", "txt") }, type: VaultActionType.CreateFile },
			{ payload: { splitPath: folder("s") }, type: VaultActionType.TrashFolder },
			{ payload: { from: folder("r"), to: folder("r1") }, type: VaultActionType.RenameFolder },
			{ payload: { splitPath: folder("q") }, type: VaultActionType.CreateFolder },
			{ payload: { splitPath: mdFile("p.md"), transform: (c) => c }, type: VaultActionType.ProcessMdFile },
		];

		const sorted = sortActionsByWeight(actions);
		expect(sorted[0].type).toBe(VaultActionType.CreateFolder);
		expect(sorted[1].type).toBe(VaultActionType.RenameFolder);
		expect(sorted[2].type).toBe(VaultActionType.TrashFolder);
		expect(sorted[3].type).toBe(VaultActionType.CreateFile);
		expect(sorted[4].type).toBe(VaultActionType.RenameFile);
		expect(sorted[5].type).toBe(VaultActionType.TrashFile);
		expect(sorted[6].type).toBe(VaultActionType.CreateMdFile);
		expect(sorted[7].type).toBe(VaultActionType.RenameMdFile);
		expect(sorted[8].type).toBe(VaultActionType.TrashMdFile);
		expect(sorted[9].type).toBe(VaultActionType.ProcessMdFile);
		expect(sorted[10].type).toBe(VaultActionType.ReplaceContentMdFile);
	});
});
