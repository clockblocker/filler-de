import { describe, expect, it } from "bun:test";
import { collapseActions } from "../../../src/obsidian-vault-action-manager/impl/collapse";
import { VaultActionType } from "../../../src/obsidian-vault-action-manager/types/vault-action";

const core = (basename: string, pathParts: string[] = []) => ({
	basename,
	pathParts,
});

describe("collapseActions", () => {
	it("keeps latest write over prior write/process", async () => {
		const firstWrite = {
			payload: { content: "first", coreSplitPath: core("a.md") },
			type: VaultActionType.WriteMdFile,
		} as const;
		const process = {
			payload: {
				coreSplitPath: core("a.md"),
				transform: (c: string) => `${c}!`,
			},
			type: VaultActionType.ProcessMdFile,
		} as const;
		const latestWrite = {
			payload: { content: "second", coreSplitPath: core("a.md") },
			type: VaultActionType.WriteMdFile,
		} as const;

		const collapsed = await collapseActions([firstWrite, process, latestWrite]);
		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]).toEqual(latestWrite);
	});

	it("composes processes in order", async () => {
		const p1 = {
			payload: {
				coreSplitPath: core("a.md"),
				transform: (c: string) => `${c}A`,
			},
			type: VaultActionType.ProcessMdFile,
		} as const;
		const p2 = {
			payload: {
				coreSplitPath: core("a.md"),
				transform: (c: string) => `${c}!`,
			},
			type: VaultActionType.ProcessMdFile,
		} as const;

		const [single] = await collapseActions([p1, p2]);
		const result = await (single as typeof p2).payload.transform("x");
		expect(result).toBe("xA!");
	});

	it("applies process after write into final write content", async () => {
		const write = {
			payload: { content: "hello", coreSplitPath: core("a.md") },
			type: VaultActionType.WriteMdFile,
		} as const;
		const process = {
			payload: {
				coreSplitPath: core("a.md"),
				transform: async (c: string) => c.toUpperCase(),
			},
			type: VaultActionType.ProcessMdFile,
		} as const;

		const [single] = await collapseActions([write, process]);
		expect(single.type).toBe(VaultActionType.WriteMdFile);
		expect((single as typeof write).payload.content).toBe("HELLO");
	});

	it("latest rename wins; duplicate identical rename is dropped", async () => {
		const r1 = {
			payload: {
				from: core("a.md", ["f"]),
				to: core("b.md", ["f"]),
			},
			type: VaultActionType.RenameMdFile,
		} as const;
		const dup = { ...r1 };
		const r2 = {
			payload: {
				from: core("a.md", ["f"]),
				to: core("c.md", ["f"]),
			},
			type: VaultActionType.RenameMdFile,
		} as const;

		const collapsed = await collapseActions([r1, dup, r2]);
		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]).toEqual(r2);
	});

	it("newest action of different type replaces prior on same key", async () => {
		const create = {
			payload: { coreSplitPath: core("a.md") },
			type: VaultActionType.CreateMdFile,
		} as const;
		const trash = {
			payload: { coreSplitPath: core("a.md") },
			type: VaultActionType.TrashMdFile,
		} as const;

		const collapsed = await collapseActions([create, trash]);
		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]).toEqual(trash);
	});
});
