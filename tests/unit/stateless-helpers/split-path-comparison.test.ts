import { describe, expect, test } from "bun:test";
import {
	splitPathsEqual,
	stringifySplitPath,
} from "../../../src/stateless-helpers/split-path-comparison";
import type {
	AnySplitPath,
	SplitPathToMdFile,
} from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";

// ─── splitPathsEqual ───

describe("splitPathsEqual", () => {
	const mdA: AnySplitPath = {
		basename: "Abend",
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: ["Wörter", "A"],
	};

	test("returns true for identical md split paths", () => {
		const mdB: AnySplitPath = { ...mdA };
		expect(splitPathsEqual(mdA, mdB)).toBe(true);
	});

	test("returns false when basename differs", () => {
		const mdB: AnySplitPath = { ...mdA, basename: "Morgen" };
		expect(splitPathsEqual(mdA, mdB)).toBe(false);
	});

	test("returns false when kind differs", () => {
		const file: AnySplitPath = {
			basename: "Abend",
			extension: "pdf",
			kind: SplitPathKind.File,
			pathParts: ["Wörter", "A"],
		};
		expect(splitPathsEqual(mdA, file)).toBe(false);
	});

	test("returns false when pathParts length differs", () => {
		const mdB: AnySplitPath = {
			...mdA,
			pathParts: ["Wörter", "A", "sub"],
		};
		expect(splitPathsEqual(mdA, mdB)).toBe(false);
	});

	test("returns false when a pathPart element differs", () => {
		const mdB: AnySplitPath = {
			...mdA,
			pathParts: ["Wörter", "B"],
		};
		expect(splitPathsEqual(mdA, mdB)).toBe(false);
	});

	test("returns false when extension differs", () => {
		const fileA: AnySplitPath = {
			basename: "photo",
			extension: "png",
			kind: SplitPathKind.File,
			pathParts: ["assets"],
		};
		const fileB: AnySplitPath = {
			basename: "photo",
			extension: "jpg",
			kind: SplitPathKind.File,
			pathParts: ["assets"],
		};
		expect(splitPathsEqual(fileA, fileB)).toBe(false);
	});

	test("returns true for folders with same basename and pathParts", () => {
		const folderA: AnySplitPath = {
			basename: "Section",
			kind: SplitPathKind.Folder,
			pathParts: ["Library"],
		};
		const folderB: AnySplitPath = {
			basename: "Section",
			kind: SplitPathKind.Folder,
			pathParts: ["Library"],
		};
		expect(splitPathsEqual(folderA, folderB)).toBe(true);
	});

	test("returns true with empty pathParts", () => {
		const a: AnySplitPath = {
			basename: "root",
			extension: "md",
			kind: SplitPathKind.MdFile,
			pathParts: [],
		};
		const b: AnySplitPath = {
			basename: "root",
			extension: "md",
			kind: SplitPathKind.MdFile,
			pathParts: [],
		};
		expect(splitPathsEqual(a, b)).toBe(true);
	});
});

// ─── stringifySplitPath ───

describe("stringifySplitPath", () => {
	test("joins pathParts and appends basename.extension", () => {
		const sp: SplitPathToMdFile = {
			basename: "Abend",
			extension: "md",
			kind: SplitPathKind.MdFile,
			pathParts: ["Wörter", "A"],
		};
		expect(stringifySplitPath(sp)).toBe("Wörter/A/Abend.md");
	});

	test("handles empty pathParts", () => {
		const sp: SplitPathToMdFile = {
			basename: "Note",
			extension: "md",
			kind: SplitPathKind.MdFile,
			pathParts: [],
		};
		expect(stringifySplitPath(sp)).toBe("Note.md");
	});

	test("handles single pathPart", () => {
		const sp: SplitPathToMdFile = {
			basename: "Test",
			extension: "md",
			kind: SplitPathKind.MdFile,
			pathParts: ["Wörter"],
		};
		expect(stringifySplitPath(sp)).toBe("Wörter/Test.md");
	});
});
