import { describe, expect, it } from "bun:test";
import {
	buildEntityMeta,
	buildLinguisticUnitMeta,
} from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
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

describe("buildLinguisticUnitMeta", () => {
	it("builds Lexem lemma metadata with full noun features", () => {
		const result = buildLinguisticUnitMeta(
			"LX-LM-NOUN-1",
			makeLexemLemmaResult(),
			makeLexemLexicalInfo(),
		);

		expect(result).toEqual({
			kind: "Lexem",
			surface: {
				features: {
					genus: "Neutrum",
					nounClass: "Common",
					pos: "Noun",
				},
				lemma: "Haus",
				surfaceKind: "Lemma",
			},
		});
	});

	it("builds Lexem inflected metadata with ref features", () => {
		const result = buildLinguisticUnitMeta(
			"LX-IN-NOUN-1",
			makeLexemLemmaResult({
				surfaceKind: "Inflected",
			}),
			makeLexemLexicalInfo({
				lemma: {
					lemma: "Haus",
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
					surfaceKind: "Inflected",
				},
			}),
		);

		expect(result).toEqual({
			kind: "Lexem",
			surface: {
				features: { pos: "Noun" },
				lemma: "Haus",
				lemmaRef: "LX-LM-NOUN-1",
				surface: "Häuser",
				surfaceKind: "Inflected",
			},
		});
	});

	it("builds Phrasem metadata from phrasemeFeatures", () => {
		const result = buildLinguisticUnitMeta(
			"PH-LM-1",
			makePhrasemLemmaResult(),
			makePhrasemLexicalInfo(),
		);

		expect(result).toEqual({
			kind: "Phrasem",
			surface: {
				features: {
					phrasemeKind: "Collocation",
				},
				lemma: "auf jeden Fall",
				surfaceKind: "Lemma",
			},
		});
	});

	it("builds Lexem lemma metadata with full verb features", () => {
		const result = buildLinguisticUnitMeta(
			"LX-LM-VRB-1",
			makeLexemLemmaResult({
				lemma: "aufmachen",
				posLikeKind: "Verb",
			}),
			makeLexemLexicalInfo({
				core: {
					status: "ready",
					value: {
						emojiDescription: ["🚪"],
						ipa: "ˈaʊ̯fˌmaxn̩",
					},
				},
				features: {
					status: "ready",
					value: {
						conjugation: "Regular",
						kind: "verb",
						valency: {
							reflexivity: "NonReflexive",
							separability: "Separable",
						},
					},
				},
				lemma: {
					lemma: "aufmachen",
					linguisticUnit: "Lexem",
					posLikeKind: "Verb",
					surfaceKind: "Lemma",
				},
			}),
		);

		expect(result).toEqual({
			kind: "Lexem",
			surface: {
				features: {
					conjugation: "Regular",
					pos: "Verb",
					valency: {
						reflexivity: "NonReflexive",
						separability: "Separable",
					},
				},
				lemma: "aufmachen",
				surfaceKind: "Lemma",
			},
		});
	});

	it("builds Lexem lemma metadata with full adjective features", () => {
		const result = buildLinguisticUnitMeta(
			"LX-LM-ADJ-1",
			makeLexemLemmaResult({
				lemma: "stolz",
				posLikeKind: "Adjective",
			}),
			makeLexemLexicalInfo({
				core: {
					status: "ready",
					value: {
						emojiDescription: ["😌"],
						ipa: "ʃtɔlts",
					},
				},
				features: {
					status: "ready",
					value: {
						classification: "Qualitative",
						distribution: "AttributiveAndPredicative",
						gradability: "Gradable",
						kind: "adjective",
						valency: {
							governedPattern: "Prepositional",
							governedPreposition: "auf",
						},
					},
				},
				lemma: {
					lemma: "stolz",
					linguisticUnit: "Lexem",
					posLikeKind: "Adjective",
					surfaceKind: "Lemma",
				},
			}),
		);

		expect(result).toEqual({
			kind: "Lexem",
			surface: {
				features: {
					classification: "Qualitative",
					distribution: "AttributiveAndPredicative",
					gradability: "Gradable",
					pos: "Adjective",
					valency: {
						governedPattern: "Prepositional",
						governedPreposition: "auf",
					},
				},
				lemma: "stolz",
				surfaceKind: "Lemma",
			},
		});
	});
});

describe("buildEntityMeta", () => {
	it("builds Lexem lemma entity with lexical genus and nounClass", () => {
		const result = buildEntityMeta(
			makeLexemLemmaResult(),
			makeLexemLexicalInfo(),
		);

		expect(result).toEqual({
			emojiDescription: ["🏠"],
			features: {
				inflectional: {},
				lexical: {
					genus: "Neutrum",
					nounClass: "Common",
					pos: "Noun",
				},
			},
			ipa: "haʊ̯s",
			language: "German",
			lemma: "Haus",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			surfaceKind: "Lemma",
		});
	});

	it("builds Lexem inflected entity with lexical POS only and surface", () => {
		const result = buildEntityMeta(
			makeLexemLemmaResult({
				surfaceKind: "Inflected",
			}),
			makeLexemLexicalInfo({
				lemma: {
					lemma: "Haus",
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
					surfaceKind: "Inflected",
				},
			}),
		);

		expect(result).toEqual({
			emojiDescription: ["🏠"],
			features: {
				inflectional: {},
				lexical: { pos: "Noun" },
			},
			ipa: "haʊ̯s",
			language: "German",
			lemma: "Haus",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			surface: "Häuser",
			surfaceKind: "Inflected",
		});
	});

	it("prefers precomputedEmojiDescription for entity signal", () => {
		const result = buildEntityMeta(
			makeLexemLemmaResult({
				precomputedEmojiDescription: ["🪑", "🌳"],
			}),
			makeLexemLexicalInfo(),
		);

		expect(result?.emojiDescription).toEqual(["🪑", "🌳"]);
	});

	it("falls back to unknown core metadata when lexical core is unavailable", () => {
		const result = buildEntityMeta(
			makeLexemLemmaResult(),
			makeLexemLexicalInfo({
				core: {
					status: "error",
					error: lexicalGenerationError(
						LexicalGenerationFailureKind.FetchFailed,
						"x",
					),
				},
			}),
		);

		expect(result?.emojiDescription).toEqual(["❓"]);
		expect(result?.ipa).toBe("unknown");
	});

	it("builds Phrasem entity with lexical phrasemeKind", () => {
		const result = buildEntityMeta(
			makePhrasemLemmaResult(),
			makePhrasemLexicalInfo(),
		);

		expect(result).toEqual({
			emojiDescription: ["✅"],
			features: {
				inflectional: {},
				lexical: { phrasemeKind: "Collocation" },
			},
			ipa: "aʊ̯f ˈjeːdn̩ fal",
			language: "German",
			lemma: "auf jeden Fall",
			linguisticUnit: "Phrasem",
			posLikeKind: "Collocation",
			surfaceKind: "Lemma",
		});
	});
});
