import { describe, expect, it } from "bun:test";
import { collapseActions } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/collapse";
import type { SplitPathToMdFile } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { VaultActionKind } from "../../../src/managers/obsidian/vault-action-manager/types/vault-action";

const mdFile = (
	basename: string,
	pathParts: string[] = [],
): SplitPathToMdFile => ({
	basename,
	extension: "md",
	kind: "MdFile",
	pathParts,
});

describe("collapseActions", () => {
	describe("ProcessMdFile composition", () => {
		it("composes multiple processes in order", async () => {
			const p1 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}A`,
				},
			} as const;
			const p2 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}B`,
				},
			} as const;

			const collapsed = await collapseActions([p1, p2]);
			const single = collapsed[0]!;
			expect(single.kind).toBe(VaultActionKind.ProcessMdFile);
			const result = await (single as typeof p2).payload.transform("x");
			expect(result).toBe("xAB");
		});

		it("composes three processes in order", async () => {
			const p1 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}1`,
				},
			} as const;
			const p2 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}2`,
				},
			} as const;
			const p3 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}3`,
				},
			} as const;

			const collapsed = await collapseActions([p1, p2, p3]);
			const single = collapsed[0]!;
			const result = await (single as typeof p3).payload.transform("x");
			expect(result).toBe("x123");
		});

		it("handles async transforms", async () => {
			const p1 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: async (c: string) => `${c}A`,
				},
			} as const;
			const p2 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: async (c: string) => `${c}B`,
				},
			} as const;

			const collapsed = await collapseActions([p1, p2]);
			const single = collapsed[0]!;
			const result = await (single as typeof p2).payload.transform("x");
			expect(result).toBe("xAB");
		});
	});

	describe("UpsertMdFile precedence", () => {
		it("latest write wins over prior write", async () => {
			const firstWrite = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "first", splitPath: mdFile("a.md") },
			} as const;
			const latestWrite = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "second", splitPath: mdFile("a.md") },
			} as const;

			const collapsed = await collapseActions([firstWrite, latestWrite]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(latestWrite);
		});

		it("write wins over prior process", async () => {
			const process = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}!`,
				},
			} as const;
			const write = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "final", splitPath: mdFile("a.md") },
			} as const;

			const collapsed = await collapseActions([process, write]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(write);
		});
	});

	describe("ProcessMdFile + UpsertMdFile interactions", () => {
		it("applies process after write into final write content", async () => {
			const write = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "hello", splitPath: mdFile("a.md") },
			} as const;
			const process = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => c.toUpperCase(),
				},
			} as const;

			const collapsed = await collapseActions([write, process]);
			const single = collapsed[0]!;
			expect(single.kind).toBe(VaultActionKind.UpsertMdFile);
			expect((single as { payload: { content: string } }).payload.content).toBe("HELLO");
		});

		it("applies process after write with async transform", async () => {
			const write = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "hello", splitPath: mdFile("a.md") },
			} as const;
			const process = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: async (c: string) => c.toUpperCase(),
				},
			} as const;

			const collapsed = await collapseActions([write, process]);
			const single = collapsed[0]!;
			expect(single.kind).toBe(VaultActionKind.UpsertMdFile);
			expect((single as { payload: { content: string } }).payload.content).toBe("HELLO");
		});

		it("discards process when write comes after", async () => {
			const process = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}!`,
				},
			} as const;
			const write = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "final", splitPath: mdFile("a.md") },
			} as const;

			const collapsed = await collapseActions([process, write]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(write);
		});

		it("discards multiple processes when write comes after", async () => {
			const p1 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}A`,
				},
			} as const;
			const p2 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}B`,
				},
			} as const;
			const write = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "final", splitPath: mdFile("a.md") },
			} as const;

			const collapsed = await collapseActions([p1, p2, write]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(write);
		});

		it("applies process to write when process comes after", async () => {
			const write = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "hello", splitPath: mdFile("a.md") },
			} as const;
			const p1 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}!`,
				},
			} as const;
			const p2 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => c.toUpperCase(),
				},
			} as const;

			const collapsed = await collapseActions([write, p1, p2]);
			const single = collapsed[0]!;
			expect(single.kind).toBe(VaultActionKind.UpsertMdFile);
			expect((single as { payload: { content: string } }).payload.content).toBe("HELLO!");
		});
	});

	describe("RenameMdFile operations", () => {
		it("latest rename wins when different targets", async () => {
			const r1 = {
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: mdFile("a.md", ["f"]),
					to: mdFile("b.md", ["f"]),
				},
			} as const;
			const r2 = {
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: mdFile("a.md", ["f"]),
					to: mdFile("c.md", ["f"]),
				},
			} as const;

			const collapsed = await collapseActions([r1, r2]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(r2);
		});

		it("drops duplicate identical rename", async () => {
			const r1 = {
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: mdFile("a.md", ["f"]),
					to: mdFile("b.md", ["f"]),
				},
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
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "initial", splitPath: mdFile("a.md") },
			} as const;
			const write = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "final", splitPath: mdFile("a.md") },
			} as const;

			const collapsed = await collapseActions([create, write]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]!.kind).toBe(VaultActionKind.UpsertMdFile);
			expect((collapsed[0] as { payload: { content: string } }).payload.content).toBe("final");
		});

		it("trash wins over create", async () => {
			const create = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { splitPath: mdFile("a.md") },
			} as const;
			const trash = {
				kind: VaultActionKind.TrashMdFile,
				payload: { splitPath: mdFile("a.md") },
			} as const;

			const collapsed = await collapseActions([create, trash]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(trash);
		});

		it("collapses UpsertMdFile(null) + UpsertMdFile(content) to UpsertMdFile(content)", async () => {
			const ensureExist = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: null, splitPath: mdFile("a.md") },
			} as const;
			const create = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "content", splitPath: mdFile("a.md") },
			} as const;

			const collapsed = await collapseActions([ensureExist, create]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]!.kind).toBe(VaultActionKind.UpsertMdFile);
			expect((collapsed[0] as { payload: { content: string } }).payload.content).toBe("content");
		});

		it("collapses UpsertMdFile(content) + UpsertMdFile(null) to UpsertMdFile(content)", async () => {
			const create = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "content", splitPath: mdFile("a.md") },
			} as const;
			const ensureExist = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: null, splitPath: mdFile("a.md") },
			} as const;

			const collapsed = await collapseActions([create, ensureExist]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]!.kind).toBe(VaultActionKind.UpsertMdFile);
			expect((collapsed[0] as { payload: { content: string } }).payload.content).toBe("content");
		});

		it("merges UpsertMdFile(null) + UpsertMdFile into UpsertMdFile with content", async () => {
			const ensureExist = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: null, splitPath: mdFile("a.md") },
			} as const;
			const write = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "final", splitPath: mdFile("a.md") },
			} as const;

			const collapsed = await collapseActions([ensureExist, write]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]!.kind).toBe(VaultActionKind.UpsertMdFile);
			expect((collapsed[0] as { payload: { content: string | null } }).payload.content).toBe("final");
		});

		it("keeps both UpsertMdFile(null) + ProcessMdFile (ProcessMdFile needs file to exist)", async () => {
			const ensureExist = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: null, splitPath: mdFile("a.md") },
			} as const;
			const process = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => c,
				},
			} as const;

			const collapsed = await collapseActions([ensureExist, process]);
			expect(collapsed).toHaveLength(2);
			// Both actions are kept - UpsertMdFile(null) to create file, ProcessMdFile to process it
			// Dependency graph ensures UpsertMdFile executes before ProcessMdFile
			const types = collapsed.map((a) => a.kind);
			expect(types).toContain(VaultActionKind.UpsertMdFile);
			expect(types).toContain(VaultActionKind.ProcessMdFile);
		});
	});

	describe("TrashMdFile terminality", () => {
		it("trash wins over process", async () => {
			const process = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}!`,
				},
			} as const;
			const trash = {
				kind: VaultActionKind.TrashMdFile,
				payload: { splitPath: mdFile("a.md") },
			} as const;

			const collapsed = await collapseActions([process, trash]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(trash);
		});

		it("trash wins over write", async () => {
			const write = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "content", splitPath: mdFile("a.md") },
			} as const;
			const trash = {
				kind: VaultActionKind.TrashMdFile,
				payload: { splitPath: mdFile("a.md") },
			} as const;

			const collapsed = await collapseActions([write, trash]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(trash);
		});

		it("trash wins over multiple operations", async () => {
			const process = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}!`,
				},
			} as const;
			const write = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "content", splitPath: mdFile("a.md") },
			} as const;
			const trash = {
				kind: VaultActionKind.TrashMdFile,
				payload: { splitPath: mdFile("a.md") },
			} as const;

			const collapsed = await collapseActions([process, write, trash]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(trash);
		});
	});

	describe("Complex scenarios", () => {
		it("handles write -> process -> write correctly", async () => {
			const w1 = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "first", splitPath: mdFile("a.md") },
			} as const;
			const process = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}!`,
				},
			} as const;
			const w2 = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "second", splitPath: mdFile("a.md") },
			} as const;

			const collapsed = await collapseActions([w1, process, w2]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(w2);
		});

		it("handles process -> process -> write correctly", async () => {
			const p1 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}A`,
				},
			} as const;
			const p2 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}B`,
				},
			} as const;
			const write = {
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "final", splitPath: mdFile("a.md") },
			} as const;

			const collapsed = await collapseActions([p1, p2, write]);
			expect(collapsed).toHaveLength(1);
			expect(collapsed[0]).toEqual(write);
		});

		it("keeps operations on different files separate", async () => {
			const a1 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}A`,
				},
			} as const;
			const b1 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("b.md"),
					transform: (c: string) => `${c}B`,
				},
			} as const;
			const a2 = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("a.md"),
					transform: (c: string) => `${c}!`,
				},
			} as const;

			const collapsed = await collapseActions([a1, b1, a2]);
			expect(collapsed).toHaveLength(2);

			const aAction = collapsed.find(
				(a) => (a.payload as { splitPath: { basename: string } }).splitPath.basename === "a.md",
			);
			const bAction = collapsed.find(
				(a) => (a.payload as { splitPath: { basename: string } }).splitPath.basename === "b.md",
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
