import { describe, expect, it } from "bun:test";
import {
	buildEntityMeta,
	buildLinguisticUnitMeta,
} from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import type { LemmaResult } from "../../../../src/commanders/textfresser/commands/lemma/types";
import type { AgentOutput } from "../../../../src/prompt-smith";

type LexemLemmaResult = Extract<LemmaResult, { linguisticUnit: "Lexem" }>;
type PhrasemLemmaResult = Extract<LemmaResult, { linguisticUnit: "Phrasem" }>;

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

function makeVerbLemmaResult(
	overrides: Partial<LexemLemmaResult> = {},
): LexemLemmaResult {
	return makeLexemLemmaResult({
		lemma: "aufmachen",
		posLikeKind: "Verb",
		...overrides,
	});
}

function makeAdjectiveLemmaResult(
	overrides: Partial<LexemLemmaResult> = {},
): LexemLemmaResult {
	return makeLexemLemmaResult({
		lemma: "stolz",
		posLikeKind: "Adjective",
		...overrides,
	});
}

function makeLexemEnrichment(
	overrides: Partial<AgentOutput<"NounEnrichment">> = {},
): AgentOutput<"NounEnrichment"> {
	return {
		emojiDescription: ["🏠"],
		genus: "Neutrum",
		ipa: "haʊ̯s",
		nounClass: "Common",
		...overrides,
	};
}

function makePhrasemEnrichment(
	overrides: Partial<AgentOutput<"PhrasemEnrichment">> = {},
): AgentOutput<"PhrasemEnrichment"> {
	return {
		emojiDescription: ["✅"],
		ipa: "aʊ̯f ˈjeːdn̩ fal",
		...overrides,
	};
}

function makeVerbLexemEnrichment(): AgentOutput<"LexemEnrichment"> {
	return {
		emojiDescription: ["🚪"],
		ipa: "ˈaʊ̯fˌmaxn̩",
	};
}

function makeAdjectiveLexemEnrichment(): AgentOutput<"LexemEnrichment"> {
	return {
		emojiDescription: ["😌"],
		ipa: "ʃtɔlts",
	};
}

function makeVerbFeatures(
	overrides: Partial<AgentOutput<"FeaturesVerb">> = {},
): AgentOutput<"FeaturesVerb"> {
	return {
		conjugation: "Rregular",
		valency: {
			reflexivity: "NonReflexive",
			separability: "Separable",
		},
		...overrides,
	};
}

function makeAdjectiveFeatures(
	overrides: Partial<AgentOutput<"FeaturesAdjective">> = {},
): AgentOutput<"FeaturesAdjective"> {
	return {
		classification: "Qualitative",
		distribution: "AttributiveAndPredicative",
		gradability: "Gradable",
		valency: {
			governedPattern: "Prepositional",
			governedPreposition: "auf",
		},
		...overrides,
	};
}

describe("buildLinguisticUnitMeta", () => {
	it("builds Lexem lemma metadata with full noun features", () => {
		const result = buildLinguisticUnitMeta(
			"LX-LM-NOUN-1",
			makeLexemLemmaResult(),
			makeLexemEnrichment(),
			null,
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
			makeLexemEnrichment(),
			null,
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
			makePhrasemEnrichment(),
			null,
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
			makeVerbLemmaResult(),
			makeVerbLexemEnrichment(),
			makeVerbFeatures(),
		);

		expect(result).toEqual({
			kind: "Lexem",
			surface: {
				features: {
					conjugation: "Rregular",
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
			makeAdjectiveLemmaResult(),
			makeAdjectiveLexemEnrichment(),
			makeAdjectiveFeatures(),
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
			makeLexemEnrichment(),
			null,
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
			makeLexemEnrichment(),
			null,
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
			makeLexemEnrichment(),
			null,
		);

		expect(result?.emojiDescription).toEqual(["🪑", "🌳"]);
	});

	it("builds Phrasem entity with lexical phrasemeKind", () => {
		const result = buildEntityMeta(
			makePhrasemLemmaResult(),
			makePhrasemEnrichment(),
			null,
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
