import { describe, expect, it } from "bun:test";
import { generateMorphemSection } from "../../../../src/commanders/textfresser/commands/generate/steps/section-generators/morphem-section-generator";
import {
	LexicalGenerationFailureKind,
	type LexicalInfo,
	lexicalGenerationError,
} from "@textfresser/lexical-generation";

function makeLexicalInfo(): Extract<
	LexicalInfo,
	{ lemma: { linguisticUnit: "Lexem" } }
> {
	return {
		core: {
			status: "ready",
			value: {
				emojiDescription: ["👂"],
				ipa: "aʊ̯fˌpasn̩",
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
		inflections: { status: "not_applicable" },
		lemma: {
			lemma: "aufpassen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Lemma",
		},
		morphemicBreakdown: {
			status: "ready",
			value: {
				morphemes: [
					{
						kind: "Prefix",
						separability: "Separable",
						surface: "auf",
					},
					{
						kind: "Root",
						lemma: "passen",
						surface: "passen",
					},
				],
			},
		},
		relations: { status: "not_applicable" },
	};
}

describe("generateMorphemSection", () => {
	it("renders morphemes directly from lexical morphemic breakdown", () => {
		const result = generateMorphemSection({
			lexicalInfo: makeLexicalInfo(),
			targetLang: "German",
		});

		expect(result?.morphemes).toEqual([
			{
				kind: "Prefix",
				linkTarget: "auf-prefix-de",
				separability: "Separable",
				surf: "auf",
			},
			{
				kind: "Root",
				lemma: "passen",
				surf: "passen",
			},
		]);
		expect(result?.section.content).toBe(
			"[[auf-prefix-de|auf]]|[[passen]]",
		);
	});

	it("returns null when morphemic breakdown is unavailable", () => {
		const result = generateMorphemSection({
			lexicalInfo: {
				...makeLexicalInfo(),
				morphemicBreakdown: {
					error: lexicalGenerationError(
						LexicalGenerationFailureKind.InvalidModelOutput,
						"nope",
					),
					status: "error",
				},
			},
			targetLang: "German",
		});

		expect(result).toBeNull();
	});
});
