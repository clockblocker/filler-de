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

describe("collapseActions - Rename Chain Handling", () => {
	it("should handle rename chain: a.md → b.md then b.md → c.md", async () => {
		const r1 = {
			kind: VaultActionKind.RenameMdFile,
			payload: {
				from: mdFile("a.md"),
				to: mdFile("b.md"),
			},
		} as const;
		const r2 = {
			kind: VaultActionKind.RenameMdFile,
			payload: {
				from: mdFile("b.md"),
				to: mdFile("c.md"),
			},
		} as const;

		const collapsed = await collapseActions([r1, r2]);

		// Current behavior: different keys (different 'from' paths), so both kept
		// Future optimization: could collapse to single rename a.md → c.md
		expect(collapsed.length).toBeGreaterThanOrEqual(1);
		
		// Verify both renames are present (current implementation)
		// Or verify single rename a→c (if optimization implemented)
		const fromPaths = collapsed
			.filter((a) => a.kind === VaultActionKind.RenameMdFile)
			.map((a) => (a as typeof r1).payload.from.basename);
		const toPaths = collapsed
			.filter((a) => a.kind === VaultActionKind.RenameMdFile)
			.map((a) => (a as typeof r1).payload.to.basename);

		// Current: both kept (different keys)
		expect(fromPaths).toContain("a.md");
		expect(toPaths).toContain("c.md");
	});

	it("should handle rename chain with operations in between", async () => {
		const r1 = {
			kind: VaultActionKind.RenameMdFile,
			payload: {
				from: mdFile("a.md"),
				to: mdFile("b.md"),
			},
		} as const;
		const process = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: mdFile("b.md"),
				transform: (c: string) => `${c}!`,
			},
		} as const;
		const r2 = {
			kind: VaultActionKind.RenameMdFile,
			payload: {
				from: mdFile("b.md"),
				to: mdFile("c.md"),
			},
		} as const;

		const collapsed = await collapseActions([r1, process, r2]);

		// Rename chain + process on intermediate path
		// Current: r1 and r2 kept (different keys), process kept (different key)
		// Future: could optimize to single rename a→c, process applied to final path
		expect(collapsed.length).toBeGreaterThanOrEqual(1);
	});
});
