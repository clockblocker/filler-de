import { describe, expect, it } from "bun:test";
import { collapseVaultEvents } from "../../../src/managers/obsidian/vault-action-manager/impl/event-processing/bulk-event-emmiter/batteries/processing-chain/collapse";
import { makeKeyForEvent } from "../../../src/managers/obsidian/vault-action-manager/impl/event-processing/bulk-event-emmiter/batteries/processing-chain/helpers/make-key-for-event";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type { VaultEvent } from "../../../src/managers/obsidian/vault-action-manager/types/vault-event";
import { VaultEventKind } from "../../../src/managers/obsidian/vault-action-manager/types/vault-event";

// Helper: build split paths
const F = (path: string): SplitPathToFolder => {
	const parts = path.split("/");
	const basename = parts.pop() ?? "";
	return {
		basename,
		pathParts: parts,
		type: "Folder",
	};
};

const P = (path: string): SplitPathToMdFile | SplitPathToFile => {
	const parts = path.split("/");
	const filename = parts.pop() ?? "";
	const dot = filename.lastIndexOf(".");
	const basename = dot === -1 ? filename : filename.slice(0, dot);
	const ext = dot === -1 ? "" : filename.slice(dot + 1);

	return ext === "md"
		? { basename, extension: "md", pathParts: parts, type: "MdFile" }
		: { basename, extension: ext, pathParts: parts, type: "File" };
};

const fileRenamed = (
	from: string,
	to: string,
): Extract<VaultEvent, { type: typeof VaultEventKind.FileRenamed }> => ({
	from: P(from),
	kind: VaultEventKind.FileRenamed,
	to: P(to),
});

const folderRenamed = (
	from: string,
	to: string,
): Extract<VaultEvent, { type: typeof VaultEventKind.FolderRenamed }> => ({
	from: F(from),
	kind: VaultEventKind.FolderRenamed,
	to: F(to),
});

const fileDeleted = (
	path: string,
): Extract<VaultEvent, { type: typeof VaultEventKind.FileDeleted }> => ({
	kind: VaultEventKind.FileDeleted,
	splitPath: P(path),
});

// Helper: compare sets of events (order-independent)
const assertEventSets = (actual: VaultEvent[], expected: VaultEvent[]) => {
	const actualKeys = new Set(actual.map(makeKeyForEvent));
	const expectedKeys = new Set(expected.map(makeKeyForEvent));
	expect(actualKeys).toEqual(expectedKeys);
};

describe("collapseVaultEvents", () => {
	it("1. Exact dedupe", () => {
		const delete1 = fileDeleted("path/to/file.md");
		const delete2 = fileDeleted("path/to/file.md");

		const result = collapseVaultEvents([delete1, delete2]);

		// Should dedupe to one event
		expect(result).toHaveLength(1);
		assertEventSets(result, [delete1]);
	});

	it("2. Rename chain collapse", () => {
		const rename1 = fileRenamed("A.md", "B.md");
		const rename2 = fileRenamed("B.md", "C.md");

		const result = collapseVaultEvents([rename1, rename2]);

		// Should collapse to A→C, not contain A→B or B→C
		const expected = fileRenamed("A.md", "C.md");
		assertEventSets(result, [expected]);

		// Verify intermediate renames are not present
		const resultKeys = new Set(result.map(makeKeyForEvent));
		expect(resultKeys.has(makeKeyForEvent(rename1))).toBe(false);
		expect(resultKeys.has(makeKeyForEvent(rename2))).toBe(false);
	});

	it("3. No chain across types", () => {
		const folderRename = folderRenamed("A", "B");
		const fileRename = fileRenamed("B/x.md", "C/x.md");

		const result = collapseVaultEvents([folderRename, fileRename]);

		// Should remain unchanged (both still present)
		assertEventSets(result, [folderRename, fileRename]);
	});

	it("4. Cycle guard", () => {
		const rename1 = fileRenamed("A.md", "B.md");
		const rename2 = fileRenamed("B.md", "A.md");

		// Should not throw
		const result = collapseVaultEvents([rename1, rename2]);

		// Contract: emit only chain roots
		// In pure cycle A→B, B→A: both A and B are toKeys, so neither is a root
		expect(result).toHaveLength(0);
	});

	it("5. No-op rename removed", () => {
		const noOpRename = fileRenamed("A.md", "A.md");

		const result = collapseVaultEvents([noOpRename]);

		// Should be removed (output empty)
		expect(result).toHaveLength(0);
	});
});

