import { describe, expect, it } from "bun:test";
import {
	type AnySplitPath,
	MD,
	SplitPathKind,
	splitPathCodec,
} from "../../src";

const parseCases: readonly {
	expected: AnySplitPath;
	name: string;
	systemPath: string;
}[] = [
	{ expected: splitPathCodec.root, name: "empty root", systemPath: "" },
	{
		expected: splitPathCodec.root,
		name: "normalized root",
		systemPath: "///",
	},
	{
		expected: {
			basename: "Note-Section",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library", "Section"],
		},
		name: "nested Markdown file",
		systemPath: "Library/Section/Note-Section.md",
	},
	{
		expected: {
			basename: "image",
			extension: "png",
			kind: SplitPathKind.File,
			pathParts: ["root", "assets"],
		},
		name: "non-Markdown file",
		systemPath: "root/assets/image.png",
	},
	{
		expected: {
			basename: "Section",
			kind: SplitPathKind.Folder,
			pathParts: ["root", "library"],
		},
		name: "folder",
		systemPath: "root/library/Section",
	},
	{
		expected: {
			basename: "file.name",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["root"],
		},
		name: "multiple dots",
		systemPath: "root/file.name.md",
	},
	{
		expected: {
			basename: "file",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["root"],
		},
		name: "repeated and surrounding slashes",
		systemPath: "//root//file.md//",
	},
	{
		expected: {
			basename: "",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: [],
		},
		name: "extension-only file",
		systemPath: ".md",
	},
	{
		expected: {
			basename: "note",
			extension: "MD",
			kind: SplitPathKind.File,
			pathParts: ["root"],
		},
		name: "case-sensitive Markdown classification",
		systemPath: "root/note.MD",
	},
	{
		expected: {
			basename: "café",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["répertoire", "資料"],
		},
		name: "Unicode",
		systemPath: "répertoire/資料/café.md",
	},
];

const formatCases: readonly {
	expected: string;
	name: string;
	splitPath: AnySplitPath;
}[] = [
	{ expected: "", name: "root", splitPath: splitPathCodec.root },
	{
		expected: "root/notes/file.md",
		name: "nested Markdown file and extension",
		splitPath: {
			basename: "file",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["root", "notes"],
		},
	},
	{
		expected: "root/assets/image.png",
		name: "other file and extension",
		splitPath: {
			basename: "image",
			extension: "png",
			kind: SplitPathKind.File,
			pathParts: ["root", "assets"],
		},
	},
	{
		expected: "root/library/Section",
		name: "folder",
		splitPath: {
			basename: "Section",
			kind: SplitPathKind.Folder,
			pathParts: ["root", "library"],
		},
	},
	{
		expected: "root/file name with separators.md",
		name: "basename separator sanitation",
		splitPath: {
			basename: "file/name\\with separators",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["root"],
		},
	},
	{
		expected: "root/file with spaces.md",
		name: "surrounding basename whitespace",
		splitPath: {
			basename: "  file with spaces  ",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["root"],
		},
	},
	{
		expected: "root/file!@#$%with-special.md",
		name: "Obsidian-supported punctuation",
		splitPath: {
			basename: "file!@#$%with-special",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["root"],
		},
	},
	{
		expected: "répertoire/資料/café.md",
		name: "Unicode",
		splitPath: {
			basename: "café",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["répertoire", "資料"],
		},
	},
];

const roundTripCases: readonly AnySplitPath[] = [
	splitPathCodec.root,
	{ basename: "Library", kind: SplitPathKind.Folder, pathParts: [] },
	{
		basename: "Section",
		kind: SplitPathKind.Folder,
		pathParts: ["Library"],
	},
	{
		basename: "file.name",
		extension: MD,
		kind: SplitPathKind.MdFile,
		pathParts: ["root", "notes"],
	},
	{
		basename: "image",
		extension: "png",
		kind: SplitPathKind.File,
		pathParts: ["root", "assets"],
	},
];

describe("splitPathCodec", () => {
	describe("parse", () => {
		for (const { expected, name, systemPath } of parseCases) {
			it(name, () => {
				expect(splitPathCodec.parse(systemPath)).toEqual(expected);
			});
		}
	});

	describe("format", () => {
		for (const { expected, name, splitPath } of formatCases) {
			it(name, () => {
				expect(splitPathCodec.format(splitPath)).toBe(expected);
			});
		}
	});

	it("round-trips every Split Path kind through the public interface", () => {
		for (const splitPath of roundTripCases) {
			expect(
				splitPathCodec.parse(splitPathCodec.format(splitPath)),
			).toEqual(splitPath);
		}
	});
});
