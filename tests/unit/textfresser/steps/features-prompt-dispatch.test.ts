import { describe, expect, it } from "bun:test";
import { getFeaturesPromptKindForPos } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import { PromptKind } from "../../../../src/prompt-smith/codegen/consts";

describe("getFeaturesPromptKindForPos", () => {
	it("maps every Lexem POS to a dedicated Features prompt kind", () => {
		expect(getFeaturesPromptKindForPos("Noun")).toBe(PromptKind.FeaturesNoun);
		expect(getFeaturesPromptKindForPos("Pronoun")).toBe(
			PromptKind.FeaturesPronoun,
		);
		expect(getFeaturesPromptKindForPos("Article")).toBe(
			PromptKind.FeaturesArticle,
		);
		expect(getFeaturesPromptKindForPos("Adjective")).toBe(
			PromptKind.FeaturesAdjective,
		);
		expect(getFeaturesPromptKindForPos("Verb")).toBe(PromptKind.FeaturesVerb);
		expect(getFeaturesPromptKindForPos("Preposition")).toBe(
			PromptKind.FeaturesPreposition,
		);
		expect(getFeaturesPromptKindForPos("Adverb")).toBe(
			PromptKind.FeaturesAdverb,
		);
		expect(getFeaturesPromptKindForPos("Particle")).toBe(
			PromptKind.FeaturesParticle,
		);
		expect(getFeaturesPromptKindForPos("Conjunction")).toBe(
			PromptKind.FeaturesConjunction,
		);
		expect(getFeaturesPromptKindForPos("InteractionalUnit")).toBe(
			PromptKind.FeaturesInteractionalUnit,
		);
	});
});
