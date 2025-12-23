import { describe, expect, it } from "bun:test";
import { collapseActions } from "../../../src/obsidian-vault-action-manager/impl/collapse";
import type { SplitPathToMdFile } from "../../../src/obsidian-vault-action-manager/types/split-path";
import { VaultActionType } from "../../../src/obsidian-vault-action-manager/types/vault-action";

const mdFile = (
	basename: string,
	pathParts: string[] = [],
): SplitPathToMdFile => ({
	basename,
	extension: "md",
	pathParts,
	type: "MdFile",
});

describe("collapseActions", () => {
	describe("ProcessMdFile composition", () => {
		it("composes multiple processes in order", async () => {
			const p1 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}A`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const p2 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}B`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;

			const [single] = await collapseActions([p1, p2]);
			expect(single.type).toBe(VaultActionType.ProcessMdFile);
			const result = await (single as typeof p2).payload.transform("x");
			expect(result).toBe("xAB");
		});

		it("composes three processes in order", async () => {
			const p1 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}1`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const p2 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}2`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const p3 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}3`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;

			const [single] = await collapseActions([p1, p2, p3]);
			const result = await (single as typeof p3).payload.transform("x");
			expect(result).toBe("x123");
		});

		it("handles async transforms", async () => {
			const p1 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: async (c: string) => `${c}A`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const p2 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: async (c: string) => `${c}B`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;

			const [single] = await collapseActions([p1, p2]);
			const result = await (single as typeof p2).payload.transform("x");
			expect(result).toBe("xAB");
		});
	});

	describe("ReplaceContentMdFile precedence", () => {
		it("latest write wins over prior write", async () => {
			const firstWrite = {
				payload: { content: "first", splitPath: mdFile("a.md") },
				type: VaultActionType.ReplaceContentMdFile,
			} as const;
			const latestWrite = {
				payload: { content: "second", splitPath: mdFile("a.md") },
				type: VaultActionType.ReplaceContentMdFile,
			} as const;

			const collapsed = await collapseActions([firstWrite, latestWrite]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(latestWrite);
		});

		it("write wins over prior process", async () => {
			const process = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}!`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const write = {
				payload: { content: "final", splitPath: mdFile("a.md") },
				type: VaultActionType.ReplaceContentMdFile,
			} as const;

			const collapsed = await collapseActions([process, write]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(write);
		});
	});

	describe("ProcessMdFile + ReplaceContentMdFile interactions", () => {
		it("applies process after write into final write content", async () => {
			const write = {
				payload: { content: "hello", splitPath: mdFile("a.md") },
				type: VaultActionType.ReplaceContentMdFile,
			} as const;
			const process = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => c.toUpperCase(),
				},
				type: VaultActionType.ProcessMdFile,
			} as const;

			const [single] = await collapseActions([write, process]);
			expect(single.type).toBe(VaultActionType.ReplaceContentMdFile);
			expect((single as typeof write).payload.content).toBe("HELLO");
		});

		it("applies process after write with async transform", async () => {
			const write = {
				payload: { content: "hello", splitPath: mdFile("a.md") },
				type: VaultActionType.ReplaceContentMdFile,
			} as const;
			const process = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: async (c: string) => c.toUpperCase(),
				},
				type: VaultActionType.ProcessMdFile,
			} as const;

			const [single] = await collapseActions([write, process]);
			expect(single.type).toBe(VaultActionType.ReplaceContentMdFile);
			expect((single as typeof write).payload.content).toBe("HELLO");
		});

		it("discards process when write comes after", async () => {
			const process = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}!`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const write = {
				payload: { content: "final", splitPath: mdFile("a.md") },
				type: VaultActionType.ReplaceContentMdFile,
			} as const;

			const collapsed = await collapseActions([process, write]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(write);
		});

		it("discards multiple processes when write comes after", async () => {
			const p1 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}A`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const p2 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}B`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const write = {
				payload: { content: "final", splitPath: mdFile("a.md") },
				type: VaultActionType.ReplaceContentMdFile,
			} as const;

			const collapsed = await collapseActions([p1, p2, write]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(write);
		});

		it("applies process to write when process comes after", async () => {
			const write = {
				payload: { content: "hello", splitPath: mdFile("a.md") },
				type: VaultActionType.ReplaceContentMdFile,
			} as const;
			const p1 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}!`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const p2 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => c.toUpperCase(),
				},
				type: VaultActionType.ProcessMdFile,
			} as const;

			const [single] = await collapseActions([write, p1, p2]);
			expect(single.type).toBe(VaultActionType.ReplaceContentMdFile);
			expect((single as typeof write).payload.content).toBe("HELLO!");
		});
	});

	describe("RenameMdFile operations", () => {
		it("latest rename wins when different targets", async () => {
			const r1 = {
				payload: {
					from: mdFile("a.md", ["f"]),
					to: mdFile("b.md", ["f"]),
				},
				type: VaultActionType.RenameMdFile,
			} as const;
			const r2 = {
				payload: {
					from: mdFile("a.md", ["f"]),
					to: mdFile("c.md", ["f"]),
				},
				type: VaultActionType.RenameMdFile,
			} as const;

			const collapsed = await collapseActions([r1, r2]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(r2);
		});

		it("drops duplicate identical rename", async () => {
			const r1 = {
				payload: {
					from: mdFile("a.md", ["f"]),
					to: mdFile("b.md", ["f"]),
				},
				type: VaultActionType.RenameMdFile,
			} as const;
			const dup = { ...r1 };

			const collapsed = await collapseActions([r1, dup]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(r1);
		});
	});

	describe("UpsertMdFile + other operations", () => {
		it("merges create with write into create with final content", async () => {
			const create = {
				payload: { content: "initial", splitPath: mdFile("a.md") },
				type: VaultActionType.UpsertMdFile,
			} as const;
			const write = {
				payload: { content: "final", splitPath: mdFile("a.md") },
				type: VaultActionType.ReplaceContentMdFile,
			} as const;

			const collapsed = await collapseActions([create, write]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0].type).toBe(VaultActionType.UpsertMdFile);
			expect((collapsed[0] as typeof create).payload.content).toBe("final");
		});

		it("trash wins over create", async () => {
			const create = {
				payload: { splitPath: mdFile("a.md") },
				type: VaultActionType.UpsertMdFile,
			} as const;
			const trash = {
				payload: { splitPath: mdFile("a.md") },
				type: VaultActionType.TrashMdFile,
			} as const;

			const collapsed = await collapseActions([create, trash]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(trash);
		});
	});

	describe("TrashMdFile terminality", () => {
		it("trash wins over process", async () => {
			const process = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}!`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const trash = {
				payload: { splitPath: mdFile("a.md") },
				type: VaultActionType.TrashMdFile,
			} as const;

			const collapsed = await collapseActions([process, trash]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(trash);
		});

		it("trash wins over write", async () => {
			const write = {
				payload: { content: "content", splitPath: mdFile("a.md") },
				type: VaultActionType.ReplaceContentMdFile,
			} as const;
			const trash = {
				payload: { splitPath: mdFile("a.md") },
				type: VaultActionType.TrashMdFile,
			} as const;

			const collapsed = await collapseActions([write, trash]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(trash);
		});

		it("trash wins over multiple operations", async () => {
			const process = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}!`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const write = {
				payload: { content: "content", splitPath: mdFile("a.md") },
				type: VaultActionType.ReplaceContentMdFile,
			} as const;
			const trash = {
				payload: { splitPath: mdFile("a.md") },
				type: VaultActionType.TrashMdFile,
			} as const;

			const collapsed = await collapseActions([process, write, trash]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(trash);
		});
	});

	describe("Complex scenarios", () => {
		it("handles write -> process -> write correctly", async () => {
			const w1 = {
				payload: { content: "first", splitPath: mdFile("a.md") },
				type: VaultActionType.ReplaceContentMdFile,
			} as const;
			const process = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}!`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const w2 = {
				payload: { content: "second", splitPath: mdFile("a.md") },
				type: VaultActionType.ReplaceContentMdFile,
			} as const;

			const collapsed = await collapseActions([w1, process, w2]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(w2);
		});

		it("handles process -> process -> write correctly", async () => {
			const p1 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}A`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const p2 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}B`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const write = {
				payload: { content: "final", splitPath: mdFile("a.md") },
				type: VaultActionType.ReplaceContentMdFile,
			} as const;

			const collapsed = await collapseActions([p1, p2, write]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(write);
		});

		it("keeps operations on different files separate", async () => {
			const a1 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}A`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const b1 = {
				payload: {
					splitPath: mdFile("b.md"),
					transform: (c: string) => `${c}B`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;
			const a2 = {
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}!`,
				},
				type: VaultActionType.ProcessMdFile,
			} as const;

			const collapsed = await collapseActions([a1, b1, a2]);
			expect(collapsed).toHaveLength(2);

			const aAction = collapsed.find(
				(a) => a.payload.splitPath.basename === "a.md",
			);
			const bAction = collapsed.find(
				(a) => a.payload.splitPath.basename === "b.md",
			);

			expect(aAction).toBeDefined();
			expect(bAction).toBeDefined();

			const aResult = await (aAction as typeof a2).payload.transform("x");
			expect(aResult).toBe("xA!");
			const bResult = await (bAction as typeof b1).payload.transform("x");
			expect(bResult).toBe("xB");
		});
	});
});
