import { describe, expect, it } from "bun:test";
import { err, ok } from "neverthrow";
import {
	createLexicalGenerationModule,
	lexicalGenerationError,
	LexicalGenerationFailureKind,
} from "../../../src/lexical-generation";

describe("lexical-generation lexical info", () => {
	it("returns ready lexical info for a noun", async () => {
		const calls: string[] = [];
		const module = createLexicalGenerationModule({
			fetchStructured: async ({ requestLabel }) => {
				calls.push(requestLabel);
				switch (requestLabel) {
					case "NounEnrichment":
						return ok({
							emojiDescription: ["🏦"],
							genus: "Femininum",
							ipa: "baŋk",
							nounClass: "Common",
							senseGloss: "financial institution",
						});
					case "FeaturesNoun":
						return ok({ tags: ["finance", "place"] });
					case "NounInflection":
						return ok({
							cells: [
								{
									article: "die",
									case: "Nominative",
									form: "Bank",
									number: "Singular",
								},
							],
							genus: "Femininum",
						});
					case "Morphem":
						return ok({
							compounded_from: null,
							derived_from: null,
							morphemes: [],
						});
					case "Relation":
						return ok({
							relations: [{ kind: "Hypernym", words: ["Institut"] }],
						});
					default:
						throw new Error(`unexpected requestLabel ${requestLabel}`);
				}
			},
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		})._unsafeUnwrap();

		const result = await module.buildLexicalInfoGenerator()(
			{
				lemma: "Bank",
				linguisticUnit: "Lexem",
				posLikeKind: "Noun",
				surfaceKind: "Lemma",
			},
			"Ich gehe zur Bank",
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toMatchObject({
			core: {
				status: "ready",
				value: {
					emojiDescription: ["🏦"],
					ipa: "baŋk",
					senseGloss: "financial institution",
				},
			},
			features: {
				status: "ready",
				value: {
					genus: "Femininum",
					kind: "noun",
					nounClass: "Common",
					tags: ["finance", "place"],
				},
			},
			inflections: {
				status: "ready",
				value: {
					genus: "Femininum",
					kind: "noun",
				},
			},
			morphemicBreakdown: {
				status: "ready",
			},
			relations: {
				status: "ready",
			},
		});
		expect(calls).toEqual([
			"NounEnrichment",
			"FeaturesNoun",
			"Relation",
			"Morphem",
			"NounInflection",
		]);
	});

	it("marks inflections as disabled when settings turn them off", async () => {
		const calls: string[] = [];
		const module = createLexicalGenerationModule({
			fetchStructured: async ({ requestLabel }) => {
				calls.push(requestLabel);
				switch (requestLabel) {
					case "NounEnrichment":
						return ok({
							emojiDescription: ["🏦"],
							genus: "Femininum",
							ipa: "baŋk",
							nounClass: "Common",
						});
					case "FeaturesNoun":
						return ok({ tags: ["finance"] });
					case "Morphem":
						return ok({
							compounded_from: null,
							derived_from: null,
							morphemes: [],
						});
					case "Relation":
						return ok({ relations: [] });
					default:
						throw new Error(`unexpected requestLabel ${requestLabel}`);
				}
			},
			knownLang: "English",
			settings: { generateInflections: false },
			targetLang: "German",
		})._unsafeUnwrap();

		const result = await module.buildLexicalInfoGenerator()(
			{
				lemma: "Bank",
				linguisticUnit: "Lexem",
				posLikeKind: "Noun",
				surfaceKind: "Lemma",
			},
			"Ich gehe zur Bank",
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().inflections).toEqual({
			status: "disabled",
		});
		expect(calls.includes("NounInflection")).toBe(false);
	});

	it("returns field-level error for partial failures", async () => {
		const module = createLexicalGenerationModule({
			fetchStructured: async ({ requestLabel }) => {
				switch (requestLabel) {
					case "LexemEnrichment":
						return ok({
							emojiDescription: ["🚶"],
							ipa: "ɡeːən",
							senseGloss: "to walk",
						});
					case "FeaturesVerb":
						return ok({
							conjugation: "Irregular",
							valency: {
								governedPreposition: null,
								reflexivity: "NonReflexive",
								separability: "None",
							},
						});
					case "Inflection":
						return ok({ rows: [] });
					case "Relation":
						return ok({ relations: [] });
					case "Morphem":
						return err(
							lexicalGenerationError(
								LexicalGenerationFailureKind.FetchFailed,
								"morphem failed",
							),
						);
					default:
						throw new Error(`unexpected requestLabel ${requestLabel}`);
				}
			},
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		})._unsafeUnwrap();

		const result = await module.buildLexicalInfoGenerator()(
			{
				lemma: "gehen",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Lemma",
			},
			"Ich gehe nach Hause",
		);

		expect(result.isOk()).toBe(true);
		const value = result._unsafeUnwrap();
		expect(value.core.status).toBe("ready");
		expect(value.morphemicBreakdown).toMatchObject({
			error: {
				kind: LexicalGenerationFailureKind.FetchFailed,
			},
			status: "error",
		});
	});
});
