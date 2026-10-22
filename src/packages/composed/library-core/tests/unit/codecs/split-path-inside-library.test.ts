import { describe, expect, it } from "bun:test";
import {
	type AnySplitPath,
	MD,
	SplitPathKind,
} from "@textfresser/vault-action-manager";
import { makeCodecRulesFromSettings, makeCodecs } from "../../../src/codecs";
import { defaultSettingsForUnitTests } from "../common-utils/consts";

function predicateForRoot(rootPathParts: string[], rootName: string) {
	const codecs = makeCodecs(
		makeCodecRulesFromSettings({
			...defaultSettingsForUnitTests,
			splitPathToLibraryRoot: {
				basename: rootName,
				kind: SplitPathKind.Folder,
				pathParts: rootPathParts,
			},
		}),
	);
	return codecs.splitPathInsideLibrary.checkIfInsideLibrary;
}

function md(pathParts: string[], basename: string): AnySplitPath {
	return { basename, extension: MD, kind: SplitPathKind.MdFile, pathParts };
}

function folder(pathParts: string[], basename: string): AnySplitPath {
	return { basename, kind: SplitPathKind.Folder, pathParts };
}

describe("checkIfInsideLibrary", () => {
	describe("default root (Library)", () => {
		const isInside = predicateForRoot([], "Library");

		it("accepts a file directly in the root", () => {
			expect(isInside(md(["Library"], "Scroll"))).toBe(true);
		});

		it("accepts a file in a nested section", () => {
			expect(isInside(md(["Library", "A", "B"], "Scroll-B-A"))).toBe(
				true,
			);
		});

		it("accepts the root folder itself", () => {
			expect(isInside(folder([], "Library"))).toBe(true);
		});

		it("rejects a file at the vault root", () => {
			expect(isInside(md([], "README"))).toBe(false);
		});

		it("rejects a vault-root file named like the root", () => {
			expect(isInside(md([], "Library"))).toBe(false);
		});

		it("rejects a file in another folder", () => {
			expect(isInside(md(["Notes"], "x"))).toBe(false);
		});

		it("rejects a near-miss folder name", () => {
			expect(isInside(md(["Library2"], "x"))).toBe(false);
			expect(isInside(folder([], "Library2"))).toBe(false);
		});
	});

	describe("nested root (Books/Library)", () => {
		const isInside = predicateForRoot(["Books"], "Library");

		it("accepts a file inside the nested root", () => {
			expect(isInside(md(["Books", "Library"], "Scroll"))).toBe(true);
			expect(isInside(md(["Books", "Library", "A"], "Scroll-A"))).toBe(
				true,
			);
		});

		it("accepts the root folder itself", () => {
			expect(isInside(folder(["Books"], "Library"))).toBe(true);
		});

		it("rejects the root's parent folder and its other files", () => {
			expect(isInside(folder([], "Books"))).toBe(false);
			expect(isInside(md(["Books"], "x"))).toBe(false);
		});

		it("rejects a top-level folder with the root's name", () => {
			expect(isInside(md(["Library"], "x"))).toBe(false);
			expect(isInside(folder([], "Library"))).toBe(false);
		});

		it("rejects files outside and near misses", () => {
			expect(isInside(md([], "README"))).toBe(false);
			expect(isInside(md(["Books", "Library2"], "x"))).toBe(false);
			expect(isInside(md(["Books2", "Library"], "x"))).toBe(false);
		});
	});
});
