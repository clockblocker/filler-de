import { describe, expect, it } from "bun:test";
import {
	type AnySplitPath,
	MD,
	SplitPathKind,
} from "@textfresser/vault-action-manager";
import { Result } from "effect";
import { makeCodecRulesFromSettings, makeCodecs } from "../../../src/codecs";
import { splitPathsEqual } from "../../../src/healing/split-path-equality";
import { makeLibraryScope } from "../../../src/tree/library-scope";
import { defaultSettingsForUnitTests } from "../common-utils/consts";

const NFC = "Bücher";
const NFD = "Bücher";

function rulesForRoot(rootPathParts: string[], rootName: string) {
	return makeCodecRulesFromSettings({
		...defaultSettingsForUnitTests,
		splitPathToLibraryRoot: {
			basename: rootName,
			kind: SplitPathKind.Folder,
			pathParts: rootPathParts,
		},
	});
}

function md(pathParts: string[], basename: string): AnySplitPath {
	return { basename, extension: MD, kind: SplitPathKind.MdFile, pathParts };
}

function folder(pathParts: string[], basename: string): AnySplitPath {
	return { basename, kind: SplitPathKind.Folder, pathParts };
}

describe("Library membership path identity", () => {
	it("is case-sensitive, as the Library Tree spells its nodes", () => {
		const rules = rulesForRoot([], "Library");
		const { checkIfInsideLibrary } =
			makeCodecs(rules).splitPathInsideLibrary;
		const scope = makeLibraryScope(rules);
		expect(checkIfInsideLibrary(md(["library"], "Scroll"))).toBe(false);
		expect(checkIfInsideLibrary(folder([], "library"))).toBe(false);
		expect(
			Result.isFailure(scope.toLibraryPath(md(["library"], "Scroll"))),
		).toBe(true);
	});

	it("matches a root and a path whatever their Unicode composition", () => {
		const rules = rulesForRoot([NFD], "Library");
		const { checkIfInsideLibrary } =
			makeCodecs(rules).splitPathInsideLibrary;
		const scope = makeLibraryScope(rules);
		expect(checkIfInsideLibrary(md([NFC, "Library"], "Scroll"))).toBe(true);
		expect(checkIfInsideLibrary(folder([NFC], "Library"))).toBe(true);
		const scoped = scope.toLibraryPath(md([NFC, "Library", "A"], "Scroll"));
		expect(Result.isSuccess(scoped) && scoped.success.pathParts).toEqual([
			"Library",
			"A",
		]);
	});

	it("holds nothing when rooted at the vault root, as before", () => {
		const rules = rulesForRoot([], "");
		const { checkIfInsideLibrary } =
			makeCodecs(rules).splitPathInsideLibrary;
		const scope = makeLibraryScope(rules);
		expect(checkIfInsideLibrary(md(["Notes"], "x"))).toBe(false);
		expect(checkIfInsideLibrary(md([], "x"))).toBe(false);
		expect(checkIfInsideLibrary(folder([], ""))).toBe(true);
		expect(Result.isFailure(scope.toLibraryPath(md(["Notes"], "x")))).toBe(
			true,
		);
		expect(Result.isFailure(scope.toLibraryPath(md([], "x")))).toBe(true);
	});
});

describe("splitPathsEqual", () => {
	it("tells apart names that differ only in case, so Healing renames them", () => {
		expect(
			splitPathsEqual(
				md(["Library"], "scroll"),
				md(["Library"], "Scroll"),
			),
		).toBe(false);
	});

	it("tells apart kinds at one path", () => {
		expect(
			splitPathsEqual(folder(["Library"], "A"), folder(["Library"], "A")),
		).toBe(true);
		expect(
			splitPathsEqual(md(["Library"], "A"), {
				basename: "A",
				extension: MD,
				kind: SplitPathKind.File,
				pathParts: ["Library"],
			}),
		).toBe(false);
	});

	it("treats NFC and NFD spellings as one path, which Obsidian writes as NFC anyway", () => {
		expect(
			splitPathsEqual(md(["Library"], NFD), md(["Library"], NFC)),
		).toBe(true);
	});
});
