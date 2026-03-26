import { describe, expect, it } from "bun:test";
import { err, ok } from "neverthrow";
import {
	createLexicalGenerationModule,
	LexicalGenerationFailureKind,
	lexicalGenerationError,
	type StructuredFetchFn,
} from "../../../src/lexical-generation";

function okValue<T>(value: unknown) {
	return ok(value as T);
}

function errValue<T>(
	error: ReturnType<typeof lexicalGenerationError>,
) {
	return err<T, ReturnType<typeof lexicalGenerationError>>(error);
}

describe("lexical-generation lexical info", () => {
	it("returns ready lexical info for a noun", async () => {
		const calls: string[] = [];
		const module = createLexicalGenerationModule({
			fetchStructured: async <T>({
				requestLabel,
			}: Parameters<StructuredFetchFn>[0]) => {
				calls.push(requestLabel);
				switch (requestLabel) {
					case "NounEnrichment":
						return okValue<T>({
							emojiDescription: ["🏦"],
							genus: "Femininum",
							ipa: "baŋk",
							nounClass: "Common",
							senseGloss: "financial institution",
						});
					case "FeaturesNoun":
						return okValue<T>({ tags: ["finance", "place"] });
					case "NounInflection":
						return okValue<T>({
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
						return okValue<T>({
							compounded_from: null,
							derived_from: null,
							morphemes: [],
						});
					case "Relation":
						return okValue<T>({
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

		const result = await module.generateLexicalInfo(
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
					nounIdentity: {
						genus: "Femininum",
						nounClass: "Common",
					},
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
			fetchStructured: async <T>({
				requestLabel,
			}: Parameters<StructuredFetchFn>[0]) => {
				calls.push(requestLabel);
				switch (requestLabel) {
					case "NounEnrichment":
						return okValue<T>({
							emojiDescription: ["🏦"],
							genus: "Femininum",
							ipa: "baŋk",
							nounClass: "Common",
						});
					case "FeaturesNoun":
						return okValue<T>({ tags: ["finance"] });
					case "Morphem":
						return okValue<T>({
							compounded_from: null,
							derived_from: null,
							morphemes: [],
						});
					case "Relation":
						return okValue<T>({ relations: [] });
					default:
						throw new Error(`unexpected requestLabel ${requestLabel}`);
				}
			},
			knownLang: "English",
			settings: { generateInflections: false },
			targetLang: "German",
		})._unsafeUnwrap();

		const result = await module.generateLexicalInfo(
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
			fetchStructured: async <T>({
				requestLabel,
			}: Parameters<StructuredFetchFn>[0]) => {
				switch (requestLabel) {
					case "LexemEnrichment":
						return okValue<T>({
							emojiDescription: ["🚶"],
							ipa: "ɡeːən",
							senseGloss: "to walk",
						});
					case "FeaturesVerb":
						return okValue<T>({
							conjugation: "Irregular",
							valency: {
								governedPreposition: null,
								reflexivity: "NonReflexive",
								separability: "None",
							},
						});
					case "Inflection":
						return okValue<T>({ rows: [] });
					case "Relation":
						return okValue<T>({ relations: [] });
					case "Morphem":
						return errValue<T>(
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

		const result = await module.generateLexicalInfo(
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

	it("preserves noun identity from core when FeaturesNoun fails", async () => {
		const module = createLexicalGenerationModule({
			fetchStructured: async <T>({
				requestLabel,
			}: Parameters<StructuredFetchFn>[0]) => {
				switch (requestLabel) {
					case "NounEnrichment":
						return okValue<T>({
							emojiDescription: ["🏛️"],
							genus: "Neutrum",
							ipa: "bɛʁˈliːn",
							nounClass: "Proper",
						});
					case "FeaturesNoun":
						return errValue<T>(
							lexicalGenerationError(
								LexicalGenerationFailureKind.FetchFailed,
								"features failed",
							),
						);
					case "NounInflection":
						return okValue<T>({
							cells: [],
							genus: "Neutrum",
						});
					case "Morphem":
						return okValue<T>({
							compounded_from: null,
							derived_from: null,
							morphemes: [],
						});
					case "Relation":
						return okValue<T>({ relations: [] });
					default:
						throw new Error(`unexpected requestLabel ${requestLabel}`);
				}
			},
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		})._unsafeUnwrap();

		const result = await module.generateLexicalInfo(
			{
				lemma: "Berlin",
				linguisticUnit: "Lexem",
				posLikeKind: "Noun",
				surfaceKind: "Lemma",
			},
			"Ich bin in Berlin",
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toMatchObject({
			core: {
				status: "ready",
				value: {
					nounIdentity: {
						genus: "Neutrum",
						nounClass: "Proper",
					},
				},
			},
			features: {
				error: {
					kind: LexicalGenerationFailureKind.FetchFailed,
				},
				status: "error",
			},
		});
	});

	it("maps generic inflection rows into raw form arrays", async () => {
		const module = createLexicalGenerationModule({
			fetchStructured: async <T>({
				requestLabel,
			}: Parameters<StructuredFetchFn>[0]) => {
				switch (requestLabel) {
					case "LexemEnrichment":
						return okValue<T>({
							emojiDescription: ["🚶"],
							ipa: "ɡeːən",
						});
					case "FeaturesVerb":
						return okValue<T>({
							conjugation: "Regular",
							valency: {
								governedPreposition: null,
								reflexivity: "NonReflexive",
								separability: "None",
							},
						});
					case "Inflection":
						return okValue<T>({
							rows: [
								{
									forms: "[[gehe]], [[gehst]]",
									label: "Prasens",
								},
							],
						});
					case "Relation":
						return okValue<T>({ relations: [] });
					case "Morphem":
						return okValue<T>({
							compounded_from: null,
							derived_from: null,
							morphemes: [],
						});
					default:
						throw new Error(`unexpected requestLabel ${requestLabel}`);
				}
			},
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		})._unsafeUnwrap();

		const result = await module.generateLexicalInfo(
			{
				lemma: "gehen",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Lemma",
			},
			"Ich gehe nach Hause",
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().inflections).toEqual({
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
		});
	});

	it("returns top-level Err for hard-stop core prompt failures", async () => {
		const module = createLexicalGenerationModule({
			fetchStructured: async <T>({
				requestLabel,
			}: Parameters<StructuredFetchFn>[0]) => {
				if (requestLabel === "NounEnrichment") {
					return errValue<T>(
						lexicalGenerationError(
							LexicalGenerationFailureKind.InternalContractViolation,
							"contract broke",
						),
					);
				}

				throw new Error(`unexpected requestLabel ${requestLabel}`);
			},
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		})._unsafeUnwrap();

		const result = await module.generateLexicalInfo(
			{
				lemma: "Bank",
				linguisticUnit: "Lexem",
				posLikeKind: "Noun",
				surfaceKind: "Lemma",
			},
			"Ich gehe zur Bank",
		);

		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr()).toMatchObject({
			kind: LexicalGenerationFailureKind.InternalContractViolation,
			message: "contract broke",
		});
	});

	it("returns top-level Err for hard-stop sub-generation failures", async () => {
		const module = createLexicalGenerationModule({
			fetchStructured: async <T>({
				requestLabel,
			}: Parameters<StructuredFetchFn>[0]) => {
				switch (requestLabel) {
					case "LexemEnrichment":
						return okValue<T>({
							emojiDescription: ["🚶"],
							ipa: "ɡeːən",
							senseGloss: "to walk",
						});
					case "FeaturesVerb":
						return okValue<T>({
							conjugation: "Irregular",
							valency: {
								governedPreposition: null,
								reflexivity: "NonReflexive",
								separability: "None",
							},
						});
					case "Inflection":
						return okValue<T>({ rows: [] });
					case "Morphem":
						return okValue<T>({
							compounded_from: null,
							derived_from: null,
							morphemes: [],
						});
					case "Relation":
						return errValue<T>(
							lexicalGenerationError(
								LexicalGenerationFailureKind.PromptNotAvailable,
								"relation prompt missing",
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

		const result = await module.generateLexicalInfo(
			{
				lemma: "gehen",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Lemma",
			},
			"Ich gehe nach Hause",
		);

		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr()).toMatchObject({
			kind: LexicalGenerationFailureKind.PromptNotAvailable,
			message: "relation prompt missing",
		});
	});
});
