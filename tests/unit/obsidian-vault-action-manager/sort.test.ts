import { describe, expect, it } from "bun:test";
import { collapseActions } from "../../../src/obsidian-vault-action-manager/impl/collapse";
import { sortActionsByWeight, VaultActionType } from "../../../src/obsidian-vault-action-manager/types/vault-action";

const core = (basename: string, pathParts: string[] = []) => ({
	basename,
	pathParts,
});

describe("sortActionsByWeight post-collapse", () => {
	it("keeps folder creates before writes after collapse dedupe", async () => {
		const createFolder = {
			payload: { coreSplitPath: core("folder", ["root"]) },
			type: VaultActionType.CreateFolder,
		} as const;
		const write1 = {
			payload: { content: "a", coreSplitPath: core("file.md", ["root"]) },
			type: VaultActionType.WriteMdFile,
		} as const;
		const write2 = {
			payload: { content: "b", coreSplitPath: core("file.md", ["root"]) },
			type: VaultActionType.WriteMdFile,
		} as const;

		const collapsed = await collapseActions([write1, createFolder, write2]);
		const sorted = sortActionsByWeight(collapsed);

		expect(sorted[0].type).toBe(VaultActionType.CreateFolder);
		expect(sorted[1].type).toBe(VaultActionType.WriteMdFile);
		expect(
			(sorted[1] as typeof write2).payload.content,
		).toBe(write2.payload.content);
	});

	it("orders folder renames by depth when weights tie", async () => {
		const shallow = {
			payload: {
				from: core("A", ["root"]),
				to: core("A1", ["root"]),
			},
			type: VaultActionType.RenameFolder,
		} as const;
		const deep = {
			payload: {
				from: core("B", ["root", "child"]),
				to: core("B1", ["root", "child"]),
			},
			type: VaultActionType.RenameFolder,
		} as const;

		const sorted = sortActionsByWeight([deep, shallow]);
		expect(sorted[0]).toEqual(shallow);
		expect(sorted[1]).toEqual(deep);
	});
});
