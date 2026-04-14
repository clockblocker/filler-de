import { describe, expect, it } from "bun:test";
import { err, ok } from "neverthrow";
import {
	createLexicalGenerationClient,
	LexicalGenerationFailureKind,
	lexicalGenerationError,
	type StructuredFetchFn,
} from "../../src";
import { makeLexemeSelection } from "./helpers";

function okValue(value: unknown) {
	return ok(value);
}

function errValue(error: ReturnType<typeof lexicalGenerationError>) {
	return err<unknown, ReturnType<typeof lexicalGenerationError>>(error);
}

describe("lexical-generation-next lexical info", () => {
	it("returns ready lexical info for a noun", async () => {
		const calls: string[] = [];
		const client = createLexicalGenerationClient({
			fetchStructured: async ({
				requestLabel,
			}: Parameters<StructuredFetchFn>[0]) => {
				calls.push(requestLabel);
				switch (requestLabel) {
					case "GenerateCoreNoun":
						return okValue({
							senseEmojis: ["🏦"],
							ipa: "baŋk",
							senseGloss: "financial institution",
						});
					case "GenerateFeaturesNoun":
						return okValue({
							inherentFeatures: {
								gender: "Fem",
							},
						});
					case "GenerateInflectionsNoun":
						return okValue({
							cells: [
								{
									article: "die",
									case: "Nom",
									form: "Bank",
									number: "Sing",
								},
							],
							gender: "Fem",
						});
					case "GenerateMorphemicBreakdown":
						return okValue({
							morphemes: [],
						});
					case "GenerateRelations":
						return okValue({
							relations: [
								{ kind: "Hypernym", words: ["Institut"] },
							],
						});
					default:
						throw new Error(
							`unexpected requestLabel ${requestLabel}`,
						);
				}
			},
			knownLanguage: "English",
			settings: { generateInflections: true },
			targetLanguage: "German",
		})._unsafeUnwrap();

		const result = await client.generateLexicalInfo(
			makeLexemeSelection({ lemma: "Bank", pos: "NOUN" }),
			"Ich gehe zur Bank",
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toMatchObject({
			core: {
				status: "ready",
				value: {
					senseEmojis: ["🏦"],
					ipa: "baŋk",
					senseGloss: "financial institution",
				},
			},
			features: {
				status: "ready",
				value: {
					inherentFeatures: {
						gender: "Fem",
					},
				},
			},
			inflections: {
				status: "ready",
				value: {
					cells: [
						{
							article: "die",
							case: "Nom",
							form: "Bank",
							number: "Sing",
						},
					],
					gender: "Fem",
					kind: "noun",
				},
			},
			morphemicBreakdown: {
				status: "ready",
				value: {
					morphemes: [],
				},
			},
			relations: {
				status: "ready",
				value: {
					relations: [{ kind: "Hypernym", words: ["Institut"] }],
				},
			},
		});
		expect(calls).toEqual([
			"GenerateCoreNoun",
			"GenerateFeaturesNoun",
			"GenerateInflectionsNoun",
			"GenerateMorphemicBreakdown",
			"GenerateRelations",
		]);
	});

	it("marks inflections as disabled when aggregate settings turn them off", async () => {
		const calls: string[] = [];
		const client = createLexicalGenerationClient({
			fetchStructured: async ({
				requestLabel,
			}: Parameters<StructuredFetchFn>[0]) => {
				calls.push(requestLabel);
				switch (requestLabel) {
					case "GenerateCoreNoun":
						return okValue({
							senseEmojis: ["🏦"],
							ipa: "baŋk",
						});
					case "GenerateFeaturesNoun":
						return okValue({ inherentFeatures: { gender: "Fem" } });
					case "GenerateMorphemicBreakdown":
						return okValue({ morphemes: [] });
					case "GenerateRelations":
						return okValue({ relations: [] });
					default:
						throw new Error(
							`unexpected requestLabel ${requestLabel}`,
						);
				}
			},
			knownLanguage: "English",
			settings: { generateInflections: false },
			targetLanguage: "German",
		})._unsafeUnwrap();

		const result = await client.generateLexicalInfo(
			makeLexemeSelection({ lemma: "Bank", pos: "NOUN" }),
			"Ich gehe zur Bank",
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().inflections).toEqual({
			status: "disabled",
		});
		expect(calls.includes("GenerateInflectionsNoun")).toBe(false);
	});

	it("returns field-level error for partial failures", async () => {
		const client = createLexicalGenerationClient({
			fetchStructured: async ({
				requestLabel,
			}: Parameters<StructuredFetchFn>[0]) => {
				switch (requestLabel) {
					case "GenerateCoreLexeme":
						return okValue({
							senseEmojis: ["🚶"],
							ipa: "ɡeːən",
							senseGloss: "to walk",
						});
					case "GenerateFeaturesVerb":
						return okValue({
							inherentFeatures: { verbForm: "Inf" },
						});
					case "GenerateInflectionsGeneric":
						return okValue({ rows: [] });
					case "GenerateRelations":
						return okValue({ relations: [] });
					case "GenerateMorphemicBreakdown":
						return errValue(
							lexicalGenerationError(
								LexicalGenerationFailureKind.FetchFailed,
								"morphemic breakdown failed",
							),
						);
					default:
						throw new Error(
							`unexpected requestLabel ${requestLabel}`,
						);
				}
			},
			knownLanguage: "English",
			settings: { generateInflections: true },
			targetLanguage: "German",
		})._unsafeUnwrap();

		const result = await client.generateLexicalInfo(
			makeLexemeSelection({ lemma: "gehen", pos: "VERB" }),
			"Ich gehe nach Hause",
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().morphemicBreakdown).toMatchObject({
			error: {
				kind: LexicalGenerationFailureKind.FetchFailed,
			},
			status: "error",
		});
	});

	it("preserves precomputed emoji description in aggregate core output", async () => {
		const client = createLexicalGenerationClient({
			fetchStructured: async ({
				requestLabel,
			}: Parameters<StructuredFetchFn>[0]) => {
				switch (requestLabel) {
					case "GenerateCoreNoun":
						return okValue({
							senseEmojis: ["🏦"],
							ipa: "baŋk",
						});
					case "GenerateFeaturesNoun":
						return okValue({ inherentFeatures: { gender: "Fem" } });
					case "GenerateInflectionsNoun":
						return okValue({ cells: [], gender: "Fem" });
					case "GenerateMorphemicBreakdown":
						return okValue({ morphemes: [] });
					case "GenerateRelations":
						return okValue({ relations: [] });
					default:
						throw new Error(
							`unexpected requestLabel ${requestLabel}`,
						);
				}
			},
			knownLanguage: "English",
			settings: { generateInflections: true },
			targetLanguage: "German",
		})._unsafeUnwrap();

		const result = await client.generateLexicalInfo(
			makeLexemeSelection({ lemma: "Bank", pos: "NOUN" }),
			"Ich sitze auf der Bank",
			{
				precomputedSenseEmojis: ["🪑", "🌳"],
			},
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().core).toMatchObject({
			status: "ready",
			value: {
				senseEmojis: ["🪑", "🌳"],
				ipa: "baŋk",
			},
		});
	});

	it("surfaces invalid feature payloads as field errors instead of native data", async () => {
		const client = createLexicalGenerationClient({
			fetchStructured: async ({
				requestLabel,
			}: Parameters<StructuredFetchFn>[0]) => {
				switch (requestLabel) {
					case "GenerateCoreNoun":
						return okValue({
							senseEmojis: ["🏦"],
							ipa: "baŋk",
						});
					case "GenerateFeaturesNoun":
						return okValue({
							inherentFeatures: {
								gender: "NotAGender",
							},
						});
					case "GenerateInflectionsNoun":
						return okValue({ cells: [], gender: "Fem" });
					case "GenerateMorphemicBreakdown":
						return okValue({ morphemes: [] });
					case "GenerateRelations":
						return okValue({ relations: [] });
					default:
						throw new Error(
							`unexpected requestLabel ${requestLabel}`,
						);
				}
			},
			knownLanguage: "English",
			settings: { generateInflections: true },
			targetLanguage: "German",
		})._unsafeUnwrap();

		const result = await client.generateLexicalInfo(
			makeLexemeSelection({ lemma: "Bank", pos: "NOUN" }),
			"Ich gehe zur Bank",
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().features).toMatchObject({
			error: {
				kind: LexicalGenerationFailureKind.InvalidModelOutput,
			},
			status: "error",
		});
	});
});
