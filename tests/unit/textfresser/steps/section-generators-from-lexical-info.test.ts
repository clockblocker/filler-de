import { describe, expect, it } from "bun:test";
import { generateInflectionSection } from "../../../../src/commanders/textfresser/commands/generate/steps/section-generators/inflection-section-generator";
import { generateRelationSection } from "../../../../src/commanders/textfresser/commands/generate/steps/section-generators/relation-section-generator";
import { generateTagsSection } from "../../../../src/commanders/textfresser/commands/generate/steps/section-generators/tags-section-generator";
import type { LexicalInfo } from "@textfresser/lexical-generation";

function makeVerbLexicalInfo(): Extract<
	LexicalInfo,
	{ lemma: { linguisticUnit: "Lexem" } }
> {
	return {
		core: {
			status: "ready",
			value: {
				emojiDescription: ["🚶"],
				ipa: "ɡeːən",
			},
		},
		features: {
			status: "ready",
			value: {
				conjugation: "Regular",
				kind: "verb",
				valency: {
					governedPreposition: "auf",
					reflexivity: "OptionalReflexive",
					separability: "Separable",
				},
			},
		},
		inflections: {
			status: "ready",
			value: {
				kind: "generic",
				rows: [
					{
						forms: [{ form: "gehe" }, { form: "gehst" }],
						label: "Prasens",
					},
				],
			},
		},
		lemma: {
			lemma: "gehen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Lemma",
		},
		morphemicBreakdown: { status: "not_applicable" },
		relations: {
			status: "ready",
			value: {
				relations: [{ kind: "Synonym", words: ["laufen"] }],
			},
		},
	};
}

function makeNounLexicalInfo(): Extract<
	LexicalInfo,
	{ lemma: { linguisticUnit: "Lexem" } }
> {
	return {
		core: {
			status: "ready",
			value: {
				emojiDescription: ["🏭"],
				ipa: "kraftvɛʁk",
			},
		},
		features: {
			status: "ready",
			value: {
				genus: "Neutrum",
				kind: "noun",
				nounClass: "Common",
				tags: ["industry", "energy"],
			},
		},
		inflections: {
			status: "ready",
			value: {
				cells: [
					{
						article: "das",
						case: "Nominative",
						form: "Kraftwerk",
						number: "Singular",
					},
					{
						article: "die",
						case: "Nominative",
						form: "Kraftwerke",
						number: "Plural",
					},
				],
				genus: "Neutrum",
				kind: "noun",
			},
		},
		lemma: {
			lemma: "Kraftwerk",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			surfaceKind: "Lemma",
		},
		morphemicBreakdown: { status: "not_applicable" },
		relations: { status: "not_applicable" },
	};
}

function makeAdjectiveLexicalInfo(): Extract<
	LexicalInfo,
	{ lemma: { linguisticUnit: "Lexem" } }
> {
	return {
		core: {
			status: "ready",
			value: {
				emojiDescription: ["✨"],
				ipa: "ʃnɛl",
			},
		},
		features: {
			status: "ready",
			value: {
				classification: "Qualitative",
				distribution: "AttributiveOnly",
				gradability: "Gradable",
				kind: "adjective",
				valency: {
					governedPattern: "Prepositional",
					governedPreposition: "zu",
				},
			},
		},
		inflections: { status: "not_applicable" },
		lemma: {
			lemma: "schnell",
			linguisticUnit: "Lexem",
			posLikeKind: "Adjective",
			surfaceKind: "Lemma",
		},
		morphemicBreakdown: { status: "not_applicable" },
		relations: { status: "not_applicable" },
	};
}

describe("section generators from LexicalInfo", () => {
	it("renders tags from lexical features", () => {
		const verbSection = generateTagsSection({
			lexicalInfo: makeVerbLexicalInfo(),
			targetLang: "German",
		});
		expect(verbSection?.content).toBe(
			"#verb/conjugation-regular/separability-separable/reflexivity-optionalreflexive/prep-auf",
		);

		const adjectiveSection = generateTagsSection({
			lexicalInfo: makeAdjectiveLexicalInfo(),
			targetLang: "German",
		});
		expect(adjectiveSection?.content).toBe(
			"#adjective/classification-qualitative/gradability-gradable/distribution-attributiveonly/valency-prepositional/prep-zu",
		);
	});

	it("renders relation section and parsed relations from lexical relations", () => {
		const result = generateRelationSection({
			lexicalInfo: makeVerbLexicalInfo(),
			targetLang: "German",
		});

		expect(result.relations).toEqual([{ kind: "Synonym", words: ["laufen"] }]);
		expect(result.section?.content).toBe("= [[laufen]]");
	});

	it("renders noun and generic inflections from lexical inflection data", () => {
		const nounResult = generateInflectionSection({
			lexicalInfo: makeNounLexicalInfo(),
			targetLang: "German",
		});
		expect(nounResult.section?.content).toBe(
			"N: das [[Kraftwerk]], die [[Kraftwerke]]",
		);
		expect(nounResult.inflectionCells).toHaveLength(2);

		const genericResult = generateInflectionSection({
			lexicalInfo: makeVerbLexicalInfo(),
			targetLang: "German",
		});
		expect(genericResult.section?.content).toBe(
			"Prasens: [[gehe]], [[gehst]]",
		);
	});
});
