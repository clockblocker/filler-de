import { describe, expect, it } from "bun:test";
import {
	buildClosedSetLibraryPath,
	computeFinalTarget,
	computePrePromptTarget,
	formatLinkTarget,
	isClosedSetPos,
} from "../../../../src/commanders/textfresser/common/lemma-link-routing";
import type { SplitPathToMdFile } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";

function makePath(
	basename: string,
	pathParts: string[],
): SplitPathToMdFile {
	return {
		basename,
		extension: "md",
		kind: "MdFile",
		pathParts,
	};
}

describe("lemma-link-routing", () => {
	it("detects closed-set lexem POS correctly", () => {
		expect(isClosedSetPos("Pronoun")).toBe(true);
		expect(isClosedSetPos("Article")).toBe(true);
		expect(isClosedSetPos("Conjunction")).toBe(true);
		expect(isClosedSetPos("Noun")).toBe(false);
		expect(isClosedSetPos("Verb")).toBe(false);
	});

	it("builds closed-set Library path as <lemma>.md", () => {
		const path = buildClosedSetLibraryPath("ich", "German", "Pronoun");
		expect(path.basename).toBe("ich");
		expect(path.pathParts).toEqual(["Library", "de", "pronoun"]);
	});

	it("pre-prompt target: resolver match wins over library lookup", () => {
		const sourcePath = makePath("Source", ["Books", "A"]);
		const resolverPath = makePath("gehen", ["Worter", "de", "lexem", "lemma", "g", "geh", "gehen"]);

		const target = computePrePromptTarget({
			lookupInLibrary: () => [makePath("gehen", ["Library", "de", "verb"])],
			resolveLinkpathDest: () => resolverPath,
			sourcePath,
			surface: "gehen",
			targetLanguage: "German",
		});

		expect(target.splitPath).toEqual(resolverPath);
		expect(target.shouldCreatePlaceholder).toBe(false);
		expect(target.linkTarget).toBe("gehen");
	});

	it("pre-prompt target: falls back to library lookup, then to Worter placeholder", () => {
		const sourcePath = makePath("Source", ["Books", "A"]);
		const libraryPath = makePath("Staub", ["Library", "de", "noun"]);
		const fromLibrary = computePrePromptTarget({
			lookupInLibrary: () => [libraryPath],
			resolveLinkpathDest: () => null,
			sourcePath,
			surface: "Staub",
			targetLanguage: "German",
		});

		expect(fromLibrary.splitPath).toEqual(libraryPath);
		expect(fromLibrary.linkTarget).toBe("Library/de/noun/Staub");
		expect(fromLibrary.shouldCreatePlaceholder).toBe(false);

		const placeholder = computePrePromptTarget({
			lookupInLibrary: () => [],
			resolveLinkpathDest: () => null,
			sourcePath,
			surface: "Staub",
			targetLanguage: "German",
		});
		expect(placeholder.shouldCreatePlaceholder).toBe(true);
		expect(placeholder.splitPath.pathParts[0]).toBe("Worter");
	});

	it("final target resolution honors closed/open policy and precedence", () => {
		const libraryPath = makePath("ich", ["Library", "de", "pronoun"]);
		const worterPath = makePath("ich", ["Worter", "de", "lexem", "lemma", "i", "ich", "ich"]);

		const closed = computeFinalTarget({
			findByBasename: () => [worterPath, libraryPath],
			lemma: "ich",
			linguisticUnit: "Lexem",
			lookupInLibrary: () => [],
			posLikeKind: "Pronoun",
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});
		expect(closed.splitPath).toEqual(libraryPath);
		expect(closed.linkTarget).toBe("Library/de/pronoun/ich");

		const open = computeFinalTarget({
			findByBasename: () => [],
			lemma: "laufen",
			linguisticUnit: "Lexem",
			lookupInLibrary: () => [makePath("laufen", ["Library", "de", "verb"])],
			posLikeKind: "Verb",
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});
		expect(open.splitPath.pathParts[0]).toBe("Worter");
		expect(open.splitPath.basename).toBe("laufen");
		expect(open.linkTarget).toBe("laufen");
	});

	it("formats link target as full path for Library and basename for Worter", () => {
		const library = makePath("ich", ["Library", "de", "pronoun"]);
		const worter = makePath("laufen", ["Worter", "de", "lexem", "lemma", "l", "lau", "laufe"]);

		expect(formatLinkTarget(library)).toBe("Library/de/pronoun/ich");
		expect(formatLinkTarget(worter)).toBe("laufen");
	});
});
