import { describe, expect, it } from "bun:test";
import { buildLinguisticUnitMeta } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
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

function makeLexemEnrichment(
	overrides: Partial<AgentOutput<"LexemEnrichment">> = {},
): AgentOutput<"LexemEnrichment"> {
	return {
		emojiDescription: ["🏠"],
		genus: "Neutrum",
		ipa: "haʊ̯s",
		linguisticUnit: "Lexem",
		nounClass: "Common",
		posLikeKind: "Noun",
		...overrides,
	};
}

function makePhrasemEnrichment(
	overrides: Partial<AgentOutput<"PhrasemEnrichment">> = {},
): AgentOutput<"PhrasemEnrichment"> {
	return {
		emojiDescription: ["✅"],
		ipa: "aʊ̯f ˈjeːdn̩ fal",
		linguisticUnit: "Phrasem",
		posLikeKind: "Collocation",
		...overrides,
	};
}

function makeVerbLexemEnrichment(
	overrides: Partial<Extract<AgentOutput<"LexemEnrichment">, { posLikeKind: "Verb" }>> = {},
): Extract<AgentOutput<"LexemEnrichment">, { posLikeKind: "Verb" }> {
	return {
		emojiDescription: ["🚪"],
		ipa: "ˈaʊ̯fˌmaxn̩",
		linguisticUnit: "Lexem",
		posLikeKind: "Verb",
		...overrides,
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
			makePhrasemEnrichment({
				posLikeKind: "Collocation",
			}),
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

	it("returns undefined when lemma/enrichment linguistic units mismatch", () => {
		const result = buildLinguisticUnitMeta(
			"LX-LM-NOUN-1",
			makeLexemLemmaResult(),
			makePhrasemEnrichment(),
			null,
		);

		expect(result).toBeUndefined();
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
});
