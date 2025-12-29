import { describe, expect, it } from "bun:test";
import { makeSystemPathForSplitPath } from "../../../src/obsidian-vault-action-manager";
import { reduceRoots } from "../../../src/obsidian-vault-action-manager/impl/event-processing/bulk-event-emmiter/batteries/processing-chain/reduce-roots";
import { MD } from "../../../src/obsidian-vault-action-manager/types/literals";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../src/obsidian-vault-action-manager/types/split-path";
import type { VaultEvent } from "../../../src/obsidian-vault-action-manager/types/vault-event";
import { VaultEventType } from "../../../src/obsidian-vault-action-manager/types/vault-event";

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

const fileRenamed = (from: string, to: string) => ({
    from: P(from),
    to: P(to),
    type: VaultEventType.FileRenamed,
});

const folderRenamed = (
	from: string,
	to: string,
): Extract<VaultEvent, { type: typeof VaultEventType.FolderRenamed }> => ({
	from: F(from),
	to: F(to),
	type: VaultEventType.FolderRenamed,
});

const fileTrashed = (
	path: string,
): Extract<VaultEvent, { type: typeof VaultEventType.FileDeleted }> => ({
	splitPath: P(path),
	type: VaultEventType.FileDeleted,
});

const folderTrashed = (
	path: string,
): Extract<VaultEvent, { type: typeof VaultEventType.FolderDeleted }> => ({
	splitPath: F(path),
	type: VaultEventType.FolderDeleted,
});

// Helper: stable key for event comparison
const eventKey = (e: VaultEvent): string => {
	if (e.type === VaultEventType.FileRenamed || e.type === VaultEventType.FolderRenamed) {
		const from = makeSystemPathForSplitPath(e.from);
		const to = makeSystemPathForSplitPath(e.to);
		return `${e.type}:${from}→${to}`;
	}
	if (e.type === VaultEventType.FileDeleted || e.type === VaultEventType.FolderDeleted) {
		const path = makeSystemPathForSplitPath(e.splitPath);
		return `${e.type}:${path}`;
	}
	return `${e.type}:unknown`;
};

// Helper: assert roots match expected set (order-independent)
const assertRoots = (actual: VaultEvent[], expected: VaultEvent[]) => {
	expect(actual.length).toBe(expected.length);
	const actualKeys = new Set(actual.map(eventKey));
	const expectedKeys = new Set(expected.map(eventKey));
	expect(actualKeys).toEqual(expectedKeys);
};

describe("reduceRoots", () => {
	describe("Baseline (no reduction)", () => {
		it("1. Single FileRenamed", () => {
			const events = [fileRenamed("a/b.md", "a/c.md")];
			const roots = reduceRoots(events);
			assertRoots(roots, events);
		});

		it("2. Single FolderRenamed", () => {
			const events = [folderRenamed("a/b", "a/c")];
			const roots = reduceRoots(events);
			assertRoots(roots, events);
		});

		it("3. Single FileTrashed", () => {
			const events = [fileTrashed("a/b.md")];
			const roots = reduceRoots(events);
			assertRoots(roots, events);
		});

		it("4. Single FolderTrashed", () => {
			const events = [folderTrashed("a/b")];
			const roots = reduceRoots(events);
			assertRoots(roots, events);
		});
	});

	describe("Folder rename covers descendants", () => {
		it("5. FolderRenamed(A→B) + FileRenamed(A/x.md → B/x.md)", () => {
			const events = [
				folderRenamed("A", "B"),
				fileRenamed("A/x.md", "B/x.md"),
			];
			const roots = reduceRoots(events);
			assertRoots(roots, [folderRenamed("A", "B")]);
		});

		it("6. FolderRenamed(A→B) + FolderRenamed(A/sub → B/sub)", () => {
			const events = [
				folderRenamed("A", "B"),
				folderRenamed("A/sub", "B/sub"),
			];
			const roots = reduceRoots(events);
			assertRoots(roots, [folderRenamed("A", "B")]);
		});

		it("7. FolderRenamed(A→B) + FileRenamed(A/x.md → B/y.md) - suffix changed", () => {
			const events = [
				folderRenamed("A", "B"),
				fileRenamed("A/x.md", "B/y.md"),
			];
			const roots = reduceRoots(events);
			assertRoots(roots, events);
		});

		it("8. FolderRenamed(A→B) + rename outside folder", () => {
			const events = [
				folderRenamed("A", "B"),
				fileRenamed("C/x.md", "C/y.md"),
			];
			const roots = reduceRoots(events);
			assertRoots(roots, events);
		});
	});

	describe("Folder trash covers descendants", () => {
		it("9. FolderTrashed(A) + FileTrashed(A/x.md)", () => {
			const events = [folderTrashed("A"), fileTrashed("A/x.md")];
			const roots = reduceRoots(events);
			assertRoots(roots, [folderTrashed("A")]);
		});

		it("10. FolderTrashed(A) + FolderTrashed(A/sub)", () => {
			const events = [folderTrashed("A"), folderTrashed("A/sub")];
			const roots = reduceRoots(events);
			assertRoots(roots, [folderTrashed("A")]);
		});

		it("11. FolderTrashed(A) + FileTrashed(C/x.md) - outside folder", () => {
			const events = [folderTrashed("A"), fileTrashed("C/x.md")];
			const roots = reduceRoots(events);
			assertRoots(roots, events);
		});
	});

	describe("Mixed operations", () => {
		it("12. FolderRenamed(A→B) + FileTrashed(C/x.md)", () => {
			const events = [
				folderRenamed("A", "B"),
				fileTrashed("C/x.md"),
			];
			const roots = reduceRoots(events);
			assertRoots(roots, events);
		});
	});

	describe("Edge cases", () => {
		it("nested folder renames - inner folder covered", () => {
			const events = [
				folderRenamed("A", "B"),
				folderRenamed("A/sub", "B/sub"),
				fileRenamed("A/sub/x.md", "B/sub/x.md"),
			];
			const roots = reduceRoots(events);
			assertRoots(roots, [folderRenamed("A", "B")]);
		});

		it("nested folder trashes - inner folder covered", () => {
			const events = [
				folderTrashed("A"),
				folderTrashed("A/sub"),
				fileTrashed("A/sub/x.md"),
			];
			const roots = reduceRoots(events);
			assertRoots(roots, [folderTrashed("A")]);
		});

		it("folder rename with deep nested file", () => {
			const events = [
				folderRenamed("A", "B"),
				fileRenamed("A/sub/deep/x.md", "B/sub/deep/x.md"),
			];
			const roots = reduceRoots(events);
			assertRoots(roots, [folderRenamed("A", "B")]);
		});

		it("multiple independent folder renames", () => {
			const events = [
				folderRenamed("A", "B"),
				folderRenamed("C", "D"),
			];
			const roots = reduceRoots(events);
			assertRoots(roots, events);
		});

		it("duplicate folder renames - both filtered (should be deduplicated earlier)", () => {
			const events = [
				folderRenamed("A", "B"),
				folderRenamed("A", "B"),
			];
			const roots = reduceRoots(events);
			// Duplicates cover each other, resulting in 0 roots
			// This indicates duplicates should be handled in earlier pipeline stage
			expect(roots.length).toBe(0);
		});

		it("file rename with different extension", () => {
			const events = [
				folderRenamed("A", "B"),
				fileRenamed("A/x.md", "B/x.txt"),
			];
			const roots = reduceRoots(events);
			// Extension changed, so both should be roots
			assertRoots(roots, events);
		});

		it("FolderRenamed(A→B) + FileRenamed(A/x.md→C/x.md) - file moves outside", () => {
			const events = [
				folderRenamed("A", "B"),
				fileRenamed("A/x.md", "C/x.md"),
			];
			const roots = reduceRoots(events);
			// File moves outside renamed folder, so both are roots
			assertRoots(roots, events);
		});

		it("FolderRenamed(A→B) + FileRenamed(C/x.md→B/x.md) - file moves into destination", () => {
			const events = [
				folderRenamed("A", "B"),
				fileRenamed("C/x.md", "B/x.md"),
			];
			const roots = reduceRoots(events);
			// File not from A, so independent operation, both are roots
			assertRoots(roots, events);
		});

		it("FolderDeleted(A/b) + FileDeleted(A/bad/x.md) - file not in deleted folder", () => {
			const events = [
				folderTrashed("A/b"),
				fileTrashed("A/bad/x.md"),
			];
			const roots = reduceRoots(events);
			// File at A/bad is not inside A/b, so both are roots
			assertRoots(roots, events);
		});
	});

	describe("Invariants", () => {
		it("roots is always a subset of events", () => {
			const events = [
				folderRenamed("A", "B"),
				fileRenamed("A/x.md", "B/x.md"),
				fileRenamed("C/y.md", "C/z.md"),
			];
			const roots = reduceRoots(events);
			const eventKeys = new Set(events.map(eventKey));
			const rootKeys = new Set(roots.map(eventKey));
			for (const key of rootKeys) {
				expect(eventKeys.has(key)).toBe(true);
			}
		});

		it("no new events invented", () => {
			const events = [
				folderRenamed("A", "B"),
				fileRenamed("A/x.md", "B/x.md"),
			];
			const roots = reduceRoots(events);
			const eventKeys = new Set(events.map(eventKey));
			const rootKeys = new Set(roots.map(eventKey));
			expect(rootKeys.size).toBeLessThanOrEqual(eventKeys.size);
		});
	});
});

