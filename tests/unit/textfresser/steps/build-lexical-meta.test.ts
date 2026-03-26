import { describe, expect, it } from "bun:test";
import { buildLexicalMeta } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import type { LemmaResult } from "../../../../src/commanders/textfresser/commands/lemma/types";
import {
	LexicalGenerationFailureKind,
	type LexicalInfo,
	lexicalGenerationError,
} from "../../../../src/lexical-generation";

type LexemLemmaResult = Extract<LemmaResult, { linguisticUnit: "Lexem" }>;
type PhrasemLemmaResult = Extract<LemmaResult, { linguisticUnit: "Phrasem" }>;
type LexemLexicalInfo = Extract<
	LexicalInfo,
	{ lemma: { linguisticUnit: "Lexem" } }
>;
type PhrasemLexicalInfo = Extract<
	LexicalInfo,
	{ lemma: { linguisticUnit: "Phrasem" } }
>;

function makeLexemLemmaResult(
	overrides: Partial<LexemLemmaResult> = {},
): LexemLemmaResult {
	return {
		attestation: {
			source: {
				path: {
					basename: "Haus",
					extension: "md",
					kind: "MdFile",
					pathParts: ["Worter"],
				},
				ref: "![[Test#^1|^]]",
				textRaw: "Die Häuser sind alt.",
				textWithOnlyTargetMarked: "Die [Häuser] sind alt.",
			},
			target: {
				surface: "Häuser",
			},
		},
		disambiguationResult: null,
		lemma: "Haus",
		linguisticUnit: "Lexem",
		posLikeKind: "Noun",
		surfaceKind: "Lemma",
		...overrides,
	};
}

function makePhrasemLemmaResult(
	overrides: Partial<PhrasemLemmaResult> = {},
): PhrasemLemmaResult {
	return {
		attestation: {
			source: {
				path: {
					basename: "Haus",
					extension: "md",
					kind: "MdFile",
					pathParts: ["Worter"],
				},
				ref: "![[Test#^1|^]]",
				textRaw: "Die Häuser sind alt.",
				textWithOnlyTargetMarked: "Die [Häuser] sind alt.",
			},
			target: {
				surface: "Häuser",
			},
		},
		disambiguationResult: null,
		lemma: "auf jeden Fall",
		linguisticUnit: "Phrasem",
		posLikeKind: "Collocation",
		surfaceKind: "Lemma",
		...overrides,
	};
}

function makeLexemLexicalInfo(
	overrides: Partial<LexemLexicalInfo> = {},
): LexemLexicalInfo {
	return {
		core: {
			status: "ready",
			value: {
				emojiDescription: ["🏠"],
				ipa: "haʊ̯s",
			},
		},
		features: {
			status: "ready",
			value: {
				genus: "Neutrum",
				kind: "noun",
				nounClass: "Common",
				tags: [],
			},
		},
		inflections: { status: "not_applicable" },
		lemma: {
			lemma: "Haus",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			surfaceKind: "Lemma",
		},
		morphemicBreakdown: { status: "not_applicable" },
		relations: { status: "not_applicable" },
		...overrides,
	};
}

function makePhrasemLexicalInfo(
	overrides: Partial<PhrasemLexicalInfo> = {},
): PhrasemLexicalInfo {
	return {
		core: {
			status: "ready",
			value: {
				emojiDescription: ["✅"],
				ipa: "aʊ̯f ˈjeːdn̩ fal",
			},
		},
		features: {
			status: "ready",
			value: {
				kind: "tags",
				tags: [],
			},
		},
		inflections: { status: "not_applicable" },
		lemma: {
			lemma: "auf jeden Fall",
			linguisticUnit: "Phrasem",
			posLikeKind: "Collocation",
			surfaceKind: "Lemma",
		},
		morphemicBreakdown: { status: "not_applicable" },
		relations: { status: "not_applicable" },
		...overrides,
	};
}

describe("buildLexicalMeta", () => {
	it("builds lexical meta for lexem lemmas", () => {
		expect(
			buildLexicalMeta(
				makeLexemLemmaResult(),
				makeLexemLexicalInfo(),
			),
		).toEqual({
			emojiDescription: ["🏠"],
			metaTag: "lx|noun|lemma",
		});
	});

	it("builds lexical meta for phrasem lemmas", () => {
		expect(
			buildLexicalMeta(
				makePhrasemLemmaResult(),
				makePhrasemLexicalInfo(),
			),
		).toEqual({
			emojiDescription: ["✅"],
			metaTag: "ph|collocation|lemma",
		});
	});

	it("encodes non-lemma surfaces in metaTag", () => {
		expect(
			buildLexicalMeta(
				makeLexemLemmaResult({
					posLikeKind: "Verb",
					surfaceKind: "Inflected",
				}),
				makeLexemLexicalInfo({
					lemma: {
						lemma: "gehen",
						linguisticUnit: "Lexem",
						posLikeKind: "Verb",
						surfaceKind: "Inflected",
					},
				}),
			),
		).toEqual({
			emojiDescription: ["🏠"],
			metaTag: "lx|verb|inflected",
		});
	});

	it("falls back to unknown emoji when lexical core is unavailable", () => {
		expect(
			buildLexicalMeta(
				makeLexemLemmaResult(),
				makeLexemLexicalInfo({
					core: {
						error: lexicalGenerationError(
							LexicalGenerationFailureKind.FetchFailed,
							"x",
						),
						status: "error",
					},
				}),
			),
		).toEqual({
			emojiDescription: ["❓"],
			metaTag: "lx|noun|lemma",
		});
	});
});
