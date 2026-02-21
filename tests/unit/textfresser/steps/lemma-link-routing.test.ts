import { describe, expect, it } from "bun:test";
import {
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

	it("pre-prompt target: resolver match wins over library lookup", () => {
		const sourcePath = makePath("Source", ["Books", "A"]);
		const resolverPath = makePath("gehen", ["Worter", "de", "lexem", "lemma", "g", "geh", "gehen"]);

		const target = computePrePromptTarget({
			findByBasename: () => [],
			resolveLinkpathDest: () => resolverPath,
			sourcePath,
			surface: "gehen",
			targetLanguage: "German",
		});

		expect(target.splitPath).toEqual(resolverPath);
		expect(target.shouldCreatePlaceholder).toBe(false);
		expect(target.linkTarget).toBe("gehen");
	});

	it("pre-prompt target: reuses existing Worter for single-token or creates unknown temp note", () => {
		const sourcePath = makePath("Source", ["Books", "A"]);
		const existingWorter = makePath("Staub", [
			"Worter",
			"de",
			"lexem",
			"lemma",
			"s",
			"sta",
			"staub",
		]);

		const fromWorter = computePrePromptTarget({
			findByBasename: () => [existingWorter],
			resolveLinkpathDest: () => null,
			sourcePath,
			surface: "Staub",
			targetLanguage: "German",
		});

		expect(fromWorter.splitPath).toEqual(existingWorter);
		expect(fromWorter.linkTarget).toBe("Staub");
		expect(fromWorter.shouldCreatePlaceholder).toBe(false);

		const placeholder = computePrePromptTarget({
			findByBasename: () => [],
			resolveLinkpathDest: () => null,
			sourcePath,
			surface: "Staub",
			targetLanguage: "German",
		});
		expect(placeholder.shouldCreatePlaceholder).toBe(true);
		expect(placeholder.splitPath.pathParts[0]).toBe("Worter");
		expect(placeholder.splitPath.pathParts[2]).toBe("unknown");
	});

	it("pre-prompt target: multi-token selection always gets unknown temp note", () => {
		const sourcePath = makePath("Source", ["Books", "A"]);

		const target = computePrePromptTarget({
			findByBasename: () => [
				makePath("pass", ["Worter", "de", "lexem", "lemma", "p", "pas", "passa"]),
			],
			resolveLinkpathDest: () => null,
			sourcePath,
			surface: "Pass auf",
			targetLanguage: "German",
		});

		expect(target.shouldCreatePlaceholder).toBe(true);
		expect(target.splitPath.pathParts[2]).toBe("unknown");
	});

	it("final target resolution honors closed/open policy and precedence", () => {
		const libraryPath = makePath("ich-personal-pronomen-de", [
			"Library",
			"de",
			"pronoun",
		]);
		const worterPath = makePath("ich", ["Worter", "de", "lexem", "lemma", "i", "ich", "ich"]);

		const closed = computeFinalTarget({
			findByBasename: () => [worterPath],
			lemma: "ich",
			linguisticUnit: "Lexem",
			lookupInLibrary: () => [libraryPath],
			posLikeKind: "Pronoun",
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});
		expect(closed.splitPath).toEqual(worterPath);
		expect(closed.linkTarget).toBe("ich-personal-pronomen-de");
		expect(closed.linkTargetSplitPath).toEqual(libraryPath);

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

	it("formats link target as basename by default", () => {
		const library = makePath("ich", ["Library", "de", "pronoun"]);
		const worter = makePath("laufen", ["Worter", "de", "lexem", "lemma", "l", "lau", "laufe"]);

		expect(formatLinkTarget(library)).toBe("ich");
		expect(formatLinkTarget(worter)).toBe("laufen");
	});

	it("keeps basename-only rendering even with ambiguous library core lookups", () => {
		const libraryPronoun = makePath("ich", ["Library", "de", "pronoun"]);
		const libraryArticle = makePath("ich", ["Library", "de", "article"]);

		const target = computeFinalTarget({
			findByBasename: () => [libraryPronoun, libraryArticle],
			lemma: "ich",
			linguisticUnit: "Lexem",
			lookupInLibrary: () => [libraryPronoun],
			posLikeKind: "Pronoun",
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});

		expect(target.splitPath.pathParts[0]).toBe("Worter");
		expect(target.splitPath.basename).toBe("ich");
		expect(target.linkTarget).toBe("ich");
		expect(target.linkTargetSplitPath).toEqual(libraryPronoun);
	});

	it("closed-set fallback keeps attestation target on Worter when no Library match exists", () => {
		const worterPath = makePath("wir", ["Worter", "de", "lexem", "lemma", "w", "wir", "wir"]);
		const target = computeFinalTarget({
			findByBasename: () => [worterPath],
			lemma: "wir",
			linguisticUnit: "Lexem",
			lookupInLibrary: () => [],
			posLikeKind: "Pronoun",
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});

		expect(target.splitPath).toEqual(worterPath);
		expect(target.linkTarget).toBe("wir");
		expect(target.linkTargetSplitPath).toEqual(worterPath);
	});
});
