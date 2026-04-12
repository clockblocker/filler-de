import { describe, expect, it } from "bun:test";
import {
	buildFeatureTagPath,
	getFeaturesPromptKindForPos,
} from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import { PromptKind } from "@textfresser/lexical-generation";

describe("getFeaturesPromptKindForPos", () => {
	it("maps every Lexem POS to a dedicated Features prompt kind", () => {
		expect(getFeaturesPromptKindForPos("NOUN")).toBe(PromptKind.FeaturesNoun);
		expect(getFeaturesPromptKindForPos("PRON")).toBe(
			PromptKind.FeaturesPronoun,
		);
		expect(getFeaturesPromptKindForPos("DET")).toBe(
			PromptKind.FeaturesArticle,
		);
		expect(getFeaturesPromptKindForPos("ADJ")).toBe(
			PromptKind.FeaturesAdjective,
		);
		expect(getFeaturesPromptKindForPos("VERB")).toBe(PromptKind.FeaturesVerb);
		expect(getFeaturesPromptKindForPos("ADP")).toBe(
			PromptKind.FeaturesPreposition,
		);
		expect(getFeaturesPromptKindForPos("ADV")).toBe(
			PromptKind.FeaturesAdverb,
		);
		expect(getFeaturesPromptKindForPos("PART")).toBe(
			PromptKind.FeaturesParticle,
		);
		expect(getFeaturesPromptKindForPos("CCONJ")).toBe(
			PromptKind.FeaturesConjunction,
		);
		expect(getFeaturesPromptKindForPos("SCONJ")).toBe(
			PromptKind.FeaturesConjunction,
		);
		expect(getFeaturesPromptKindForPos("INTJ")).toBe(
			PromptKind.FeaturesInteractionalUnit,
		);
	});
});

describe("buildFeatureTagPath", () => {
	it("dedupes repeated tags globally while preserving first occurrence", () => {
		expect(
			buildFeatureTagPath("NOUN", [
				"masculine",
				"common",
				"common",
				"masculine",
			]),
		).toBe("#noun/masculine/common");
	});

	it("dedupes tags that repeat the POS root", () => {
		expect(buildFeatureTagPath("NOUN", ["noun", "common", "NOUN"])).toBe(
			"#noun/common",
		);
	});

	it("trims and normalizes tags to lowercase", () => {
		expect(
			buildFeatureTagPath("VERB", [" TransitIV ", " ", "STARK"]),
		).toBe("#verb/transitiv/stark");
	});
});
