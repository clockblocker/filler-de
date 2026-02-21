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

	it("pre-prompt target: keeps language scoping and resolver precedence", () => {
		const sourcePath = makePath("Source", ["Books", "A"]);
		const englishWorter = makePath("gehen", [
			"Worter",
			"en",
			"lexem",
			"lemma",
			"g",
			"geh",
			"gehen",
		]);
		const germanResolverPath = makePath("gehen", [
			"Worter",
			"de",
			"lexem",
			"lemma",
			"g",
			"geh",
			"gehen",
		]);

		const target = computePrePromptTarget({
			findByBasename: () => [englishWorter],
			resolveLinkpathDest: () => germanResolverPath,
			sourcePath,
			surface: "gehen",
			targetLanguage: "German",
		});

		expect(target.splitPath).toEqual(germanResolverPath);
		expect(target.shouldCreatePlaceholder).toBe(false);
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

	it("closed-set fallback keeps Worter target when only wrong-POS Library candidates exist", () => {
		const worterPath = makePath("die", [
			"Worter",
			"de",
			"lexem",
			"lemma",
			"d",
			"die",
			"die",
		]);
		const article = makePath("die-bestimmter-artikel-de", [
			"Library",
			"de",
			"artikel",
			"bestimmter",
		]);

		const target = computeFinalTarget({
			findByBasename: () => [worterPath],
			lemma: "die",
			linguisticUnit: "Lexem",
			lookupInLibrary: () => [article],
			posLikeKind: "Pronoun",
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});

		expect(target.splitPath).toEqual(worterPath);
		expect(target.linkTarget).toBe("die");
		expect(target.linkTargetSplitPath).toEqual(worterPath);
	});

	it("final target reuse is language-scoped for Worter matches", () => {
		const englishWorter = makePath("ich", [
			"Worter",
			"en",
			"lexem",
			"lemma",
			"i",
			"ich",
			"ich",
		]);

		const target = computeFinalTarget({
			findByBasename: () => [englishWorter],
			lemma: "ich",
			linguisticUnit: "Lexem",
			lookupInLibrary: () => [],
			posLikeKind: "Noun",
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});

		expect(target.splitPath.pathParts[0]).toBe("Worter");
		expect(target.splitPath.pathParts[1]).toBe("de");
		expect(target.splitPath.basename).toBe("ich");
		expect(target.linkTarget).toBe("ich");
	});

	it("routes phrasem targets into phrasem Worter shards", () => {
		const target = computeFinalTarget({
			findByBasename: () => [],
			lemma: "auf jeden Fall",
			linguisticUnit: "Phrasem",
			lookupInLibrary: () => [],
			posLikeKind: null,
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});

		expect(target.splitPath.pathParts[0]).toBe("Worter");
		expect(target.splitPath.pathParts[1]).toBe("de");
		expect(target.splitPath.pathParts[2]).toBe("phrasem");
		expect(target.splitPath.pathParts[3]).toBe("lemma");
		expect(target.splitPath.basename).toBe("auf jeden Fall");
	});

	it("routes inflected and variant surfaces into corresponding Worter buckets", () => {
		const inflected = computeFinalTarget({
			findByBasename: () => [],
			lemma: "aß",
			linguisticUnit: "Lexem",
			lookupInLibrary: () => [],
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
			targetLanguage: "German",
		});
		expect(inflected.splitPath.pathParts[3]).toBe("inflected");
		expect(inflected.splitPath.basename).toBe("aß");

		const variant = computeFinalTarget({
			findByBasename: () => [],
			lemma: "ass",
			linguisticUnit: "Lexem",
			lookupInLibrary: () => [],
			posLikeKind: "Verb",
			surfaceKind: "Variant",
			targetLanguage: "German",
		});
		expect(variant.splitPath.pathParts[3]).toBe("variant");
		expect(variant.splitPath.basename).toBe("ass");
	});

	it("closed-set selection filters by POS suffix and picks deterministic lexical candidate", () => {
		const pronounDemonstrative = makePath("die-demonstrativ-pronomen-de", [
			"Library",
			"de",
			"pronomen",
			"demonstrativ",
		]);
		const pronounRelative = makePath("die-relativ-pronomen-de", [
			"Library",
			"de",
			"pronomen",
			"relativ",
		]);
		const article = makePath("die-bestimmter-artikel-de", [
			"Library",
			"de",
			"artikel",
			"bestimmter",
		]);
		const target = computeFinalTarget({
			findByBasename: () => [],
			lemma: "die",
			linguisticUnit: "Lexem",
			lookupInLibrary: () => [
				pronounRelative,
				article,
				pronounDemonstrative,
			],
			posLikeKind: "Pronoun",
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});

		expect(target.linkTarget).toBe("die-demonstrativ-pronomen-de");
		expect(target.linkTargetSplitPath).toEqual(pronounDemonstrative);
	});

	it("closed-set selection ignores non-matching POS families", () => {
		const preposition = makePath("über-praeposition-de", [
			"Library",
			"de",
			"praeposition",
		]);
		const prefixTrennbar = makePath("über-trennbares-praefix-de", [
			"Library",
			"de",
			"praefix",
			"trennbares",
		]);
		const target = computeFinalTarget({
			findByBasename: () => [],
			lemma: "über",
			linguisticUnit: "Lexem",
			lookupInLibrary: () => [prefixTrennbar, preposition],
			posLikeKind: "Preposition",
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});

		expect(target.linkTarget).toBe("über-praeposition-de");
		expect(target.linkTargetSplitPath).toEqual(preposition);
	});

	it("closed-set selection narrows interactional units when suffix matches aliases", () => {
		const interactional = makePath("ja-interjektion-de", [
			"Library",
			"de",
			"interjektion",
		]);
		const particle = makePath("ja-fokuspartikel-de", [
			"Library",
			"de",
			"partikel",
		]);
		const target = computeFinalTarget({
			findByBasename: () => [],
			lemma: "ja",
			linguisticUnit: "Lexem",
			lookupInLibrary: () => [particle, interactional],
			posLikeKind: "InteractionalUnit",
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});

		expect(target.linkTarget).toBe("ja-interjektion-de");
		expect(target.linkTargetSplitPath).toEqual(interactional);
	});
});
