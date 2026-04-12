import { describe, expect, it } from "bun:test";
import { generateMorphemeSection } from "../../../../src/commanders/textfresser/commands/generate/steps/section-generators/morphem-section-generator";
import {
	LexicalGenerationFailureKind,
	lexicalGenerationError,
} from "@textfresser/lexical-generation";
import {
	makeLexemeLexicalInfo,
	makeMorphemicBreakdown,
} from "../helpers/native-fixtures";

function makeLexicalInfo() {
	return makeLexemeLexicalInfo({
		features: {
			status: "ready",
			value: {
				inherentFeatures: {
					reflex: false,
					separable: true,
				},
			},
		},
		lemma: "aufpassen",
		morphemicBreakdown: makeMorphemicBreakdown({
			morphemes: [
				{
					isSeparable: true,
					kind: "Prefix",
					surface: "auf",
				},
				{
					kind: "Root",
					lemma: "passen",
					surface: "passen",
				},
			],
		}),
		pos: "VERB",
	});
}

describe("generateMorphemeSection", () => {
	it("renders morphemes directly from lexical morphemic breakdown", () => {
		const result = generateMorphemeSection({
			lexicalInfo: makeLexicalInfo(),
			targetLang: "German",
		});

		expect(result?.morphemes).toEqual([
			{
				isSeparable: true,
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
		expect(result?.section.content).toBe("[[auf-prefix-de|auf]]|[[passen]]");
	});

	it("returns null when morphemic breakdown is unavailable", () => {
		const result = generateMorphemeSection({
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
