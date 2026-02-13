import { describe, expect, it } from "bun:test";
import {
	buildPropagationActionPair,
	type PathLookupFn,
	resolveTargetPath,
} from "../../../../src/commanders/textfresser/common/target-path-resolver";
import type { SplitPathToMdFile } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";

const EMPTY_LOOKUP: PathLookupFn = () => [];

function makeWorterPath(
	word: string,
	surfaceKind: "lemma" | "inflected",
): SplitPathToMdFile {
	return {
		basename: word,
		extension: "md",
		kind: "MdFile",
		pathParts: ["Worter", "de", "lexem", surfaceKind, word[0]!, word.slice(0, 3), word.slice(0, 5)],
	};
}

function makeLibraryPath(word: string): SplitPathToMdFile {
	return {
		basename: word,
		extension: "md",
		kind: "MdFile",
		pathParts: ["Library", "section", "subsection"],
	};
}

describe("resolveTargetPath", () => {
	it("returns computed sharded path when both lookups return empty", () => {
		const result = resolveTargetPath({
			desiredSurfaceKind: "Lemma",
			librarianLookup: EMPTY_LOOKUP,
			targetLanguage: "German",
			unitKind: "Lexem",
			vamLookup: EMPTY_LOOKUP,
			word: "anfangen",
		});

		expect(result.healingActions).toHaveLength(0);
		expect(result.splitPath.basename).toBe("anfangen");
		expect(result.splitPath.pathParts[0]).toBe("Worter");
		expect(result.splitPath.pathParts[3]).toBe("lemma");
	});

	it("returns existing VAM path when found (no healing needed)", () => {
		const existing = makeWorterPath("anfangen", "lemma");
		const result = resolveTargetPath({
			desiredSurfaceKind: "Lemma",
			librarianLookup: EMPTY_LOOKUP,
			targetLanguage: "German",
			unitKind: "Lexem",
			vamLookup: () => [existing],
			word: "anfangen",
		});

		expect(result.healingActions).toHaveLength(0);
		expect(result.splitPath).toBe(existing);
	});

	it("falls back to librarian lookup when VAM returns empty", () => {
		const libPath = makeLibraryPath("anfangen");
		const result = resolveTargetPath({
			desiredSurfaceKind: "Lemma",
			librarianLookup: () => [libPath],
			targetLanguage: "German",
			unitKind: "Lexem",
			vamLookup: EMPTY_LOOKUP,
			word: "anfangen",
		});

		expect(result.healingActions).toHaveLength(0);
		expect(result.splitPath).toBe(libPath);
	});

	it("generates RenameMdFile healing action when existing is inflected but desired is lemma", () => {
		const existing = makeWorterPath("anfangen", "inflected");
		const result = resolveTargetPath({
			desiredSurfaceKind: "Lemma",
			librarianLookup: EMPTY_LOOKUP,
			targetLanguage: "German",
			unitKind: "Lexem",
			vamLookup: () => [existing],
			word: "anfangen",
		});

		expect(result.healingActions).toHaveLength(1);
		const action = result.healingActions[0]!;
		expect(action.kind).toBe(VaultActionKind.RenameMdFile);

		const payload = action.payload as { from: SplitPathToMdFile; to: SplitPathToMdFile };
		expect(payload.from).toBe(existing);
		expect(payload.to.pathParts[3]).toBe("lemma");
		expect(result.splitPath.pathParts[3]).toBe("lemma");
	});

	it("does NOT heal when existing is lemma and desired is inflected", () => {
		const existing = makeWorterPath("Kraftwerke", "lemma");
		const result = resolveTargetPath({
			desiredSurfaceKind: "Inflected",
			librarianLookup: EMPTY_LOOKUP,
			targetLanguage: "German",
			unitKind: "Lexem",
			vamLookup: () => [existing],
			word: "Kraftwerke",
		});

		expect(result.healingActions).toHaveLength(0);
		expect(result.splitPath).toBe(existing);
	});

	it("does NOT heal Library-sourced paths", () => {
		const libPath = makeLibraryPath("anfangen");
		const result = resolveTargetPath({
			desiredSurfaceKind: "Lemma",
			librarianLookup: () => [libPath],
			targetLanguage: "German",
			unitKind: "Lexem",
			vamLookup: EMPTY_LOOKUP,
			word: "anfangen",
		});

		expect(result.healingActions).toHaveLength(0);
		expect(result.splitPath).toBe(libPath);
	});

	it("uses first match from VAM when multiple exist", () => {
		const first = makeWorterPath("anfangen", "lemma");
		const second = makeWorterPath("anfangen", "inflected");
		const result = resolveTargetPath({
			desiredSurfaceKind: "Lemma",
			librarianLookup: EMPTY_LOOKUP,
			targetLanguage: "German",
			unitKind: "Lexem",
			vamLookup: () => [first, second],
			word: "anfangen",
		});

		expect(result.splitPath).toBe(first);
	});

	it("does not heal when existing and desired surface kind match", () => {
		const existing = makeWorterPath("anfangen", "inflected");
		const result = resolveTargetPath({
			desiredSurfaceKind: "Inflected",
			librarianLookup: EMPTY_LOOKUP,
			targetLanguage: "German",
			unitKind: "Lexem",
			vamLookup: () => [existing],
			word: "anfangen",
		});

		expect(result.healingActions).toHaveLength(0);
		expect(result.splitPath).toBe(existing);
	});
});

describe("buildPropagationActionPair", () => {
	it("returns [UpsertMdFile, ProcessMdFile] with correct splitPath and transform", () => {
		const splitPath = makeWorterPath("anfangen", "lemma");
		const transform = (c: string) => c + "modified";

		const [upsert, process] = buildPropagationActionPair(splitPath, transform);

		expect(upsert.kind).toBe(VaultActionKind.UpsertMdFile);
		expect((upsert.payload as { splitPath: SplitPathToMdFile }).splitPath).toBe(splitPath);

		expect(process.kind).toBe(VaultActionKind.ProcessMdFile);
		const processPayload = process.payload as { splitPath: SplitPathToMdFile; transform: (c: string) => string };
		expect(processPayload.splitPath).toBe(splitPath);
		expect(processPayload.transform("hello")).toBe("hellomodified");
	});
});
