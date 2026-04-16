import { describe, expect, it } from "bun:test";
import {
	getInverseLexicalRelation,
	getInverseMorphologicalRelation,
	LexicalRelationsSchema,
	LingSchemaFor,
	MorphologicalRelationsSchema,
} from "../../src";
import { GermanVerbSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-verb";

const { Selection: SelectionSchema } = LingSchemaFor;

const relationId = (label: string) => `rel:${label}`;

function verbSurface(canonicalLemma: string) {
	return {
		discriminators: {
			lemmaKind: "Lexeme" as const,
			lemmaSubKind: "VERB" as const,
		},
		target: {
			canonicalLemma,
		},
	};
}

describe("German verb schemas", () => {
	it("accepts supported German verb inflectional features", () => {
		const result = GermanVerbSchemas.InflectionSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			selectionCoverage: "Full",
			spelledSelection: "ging",
			surface: {
				...verbSurface("gehen"),
				inflectionalFeatures: {
					mood: "Sub",
					number: "Sing",
					person: "3",
					tense: "Past",
					verbForm: "Fin",
				},
				normalizedFullSurface: "ging",
				surfaceKind: "Inflection",
			},
		});

		expect(result.success).toBe(true);
	});

	it("rejects unsupported UD values for German verb inflection", () => {
		const result = GermanVerbSchemas.InflectionSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			selectionCoverage: "Full",
			spelledSelection: "gehend",
			surface: {
				...verbSurface("gehen"),
				inflectionalFeatures: {
					mood: "Cnd",
					number: "Dual",
					person: "4",
					tense: "Fut",
					verbForm: "Ger",
				},
				normalizedFullSurface: "gehend",
				surfaceKind: "Inflection",
			},
		});

		expect(result.success).toBe(false);
	});

	it("accepts lexical inherent features for German verbs", () => {
		const result = GermanVerbSchemas.LemmaSchema.safeParse({
			canonicalLemma: "gehen",
			inherentFeatures: {
				governedPreposition: "auf",
				lexicallyReflexive: "Yes",
				verbType: "Mod",
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🚶",
			pos: "VERB",
		});

		expect(result.success).toBe(true);
	});

	it("accepts the new verb-specific lexical features and rejects English-only or empty values", () => {
		expect(
			GermanVerbSchemas.LemmaSchema.safeParse({
				canonicalLemma: "mitkommen",
				inherentFeatures: {
					separable: "Yes",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🚶",
				pos: "VERB",
			}).success,
		).toBe(true);

		expect(
			GermanVerbSchemas.LemmaSchema.safeParse({
				canonicalLemma: "warten",
				inherentFeatures: {
					governedPreposition: "auf",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "⏳",
				pos: "VERB",
			}).success,
		).toBe(true);

		expect(
			GermanVerbSchemas.LemmaSchema.safeParse({
				canonicalLemma: "warten",
				inherentFeatures: {
					governedPreposition: "",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "⏳",
				pos: "VERB",
			}).success,
		).toBe(false);

		expect(
			GermanVerbSchemas.LemmaSchema.safeParse({
				canonicalLemma: "mitkommen",
				inherentFeatures: {
					phrasal: "Yes",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🚶",
				pos: "VERB",
			}).success,
		).toBe(false);

		expect(
			GermanVerbSchemas.LemmaSchema.safeParse({
				canonicalLemma: "sich beeilen",
				inherentFeatures: {
					reflex: "Yes",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🏃",
				pos: "VERB",
			}).success,
		).toBe(false);

		expect(
			GermanVerbSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "gegangen",
				surface: {
					...verbSurface("gehen"),
					inflectionalFeatures: {
						aspect: "Perf",
						verbForm: "Part",
					},
					normalizedFullSurface: "gegangen",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);
	});

	it("validates relation payloads via the dedicated relation schemas", () => {
		expect(
			LexicalRelationsSchema.safeParse({
				hypernym: [relationId("Fortbewegung")],
				synonym: [relationId("Laufen")],
			}).success,
		).toBe(true);
		expect(
			MorphologicalRelationsSchema.safeParse({
				derivedFrom: [relationId("Gang")],
				sourceFor: [relationId("Ausgang")],
			}).success,
		).toBe(true);
	});

	it("rejects unsupported inherent feature keys", () => {
		const result = GermanVerbSchemas.LemmaSchema.safeParse({
			canonicalLemma: "gehen",
			inherentFeatures: {
				mood: "Ind",
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🚶",
			pos: "VERB",
		});

		expect(result.success).toBe(false);
	});

	it("accepts lemma selections where the spelled selection covers only part of the full surface", () => {
		const result = GermanVerbSchemas.LemmaSelectionSchema.safeParse({
			language: "German",
			normalizedSelectedSurface: "gehen",
			orthographicStatus: "Standard",
			selectionCoverage: "Partial",
			spelledSelection: "gehen",
			surface: {
				...verbSurface("spazieren gehen"),
				normalizedFullSurface: "spazieren gehen",
				surfaceKind: "Lemma",
			},
		});

		expect(result.success).toBe(true);
	});

	it("accepts typo inflection selections with the typo discriminant", () => {
		const result =
			GermanVerbSchemas.TypoInflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Typo",
				selectionCoverage: "Full",
				spelledSelection: "geheh",
				surface: {
					...verbSurface("gehen"),
					inflectionalFeatures: {
						mood: "Ind",
						number: "Sing",
						person: "1",
						tense: "Pres",
						verbForm: "Fin",
					},
					normalizedFullSurface: "geheh",
					surfaceKind: "Inflection",
				},
			});

		expect(result.success).toBe(true);
	});

	it("rejects normalizedSelectedSurface outside standard partial selections", () => {
		expect(
			GermanVerbSchemas.LemmaSelectionSchema.safeParse({
				language: "German",
				normalizedSelectedSurface: "gehen",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "gehen",
				surface: {
					...verbSurface("gehen"),
					normalizedFullSurface: "gehen",
					surfaceKind: "Lemma",
				},
			}).success,
		).toBe(false);

		expect(
			GermanVerbSchemas.TypoLemmaSelectionSchema.safeParse({
				language: "German",
				normalizedSelectedSurface: "gehen",
				orthographicStatus: "Typo",
				selectionCoverage: "Partial",
				spelledSelection: "geheh",
				surface: {
					...verbSurface("gehen"),
					normalizedFullSurface: "geheh",
					surfaceKind: "Lemma",
				},
			}).success,
		).toBe(false);
	});

	it("rejects impossible German verb feature combinations", () => {
		expect(
			GermanVerbSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "geht",
				surface: {
					...verbSurface("gehen"),
					inflectionalFeatures: {
						gender: "Fem",
						mood: "Ind",
						number: "Sing",
						person: "3",
						tense: "Pres",
						verbForm: "Fin",
					},
					normalizedFullSurface: "geht",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			GermanVerbSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "geh",
				surface: {
					...verbSurface("gehen"),
					inflectionalFeatures: {
						mood: "Imp",
						tense: "Past",
						verbForm: "Fin",
					},
					normalizedFullSurface: "geh",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);
	});

	it("accepts unknown selections without a surface", () => {
		const result = SelectionSchema.German.Unknown.safeParse({
			language: "German",
			orthographicStatus: "Unknown",
			spelledSelection: "unknown",
		});

		expect(result.success).toBe(true);
	});

	it("accepts duplicate relation ids and rejects non-string relation payloads", () => {
		expect(
			LexicalRelationsSchema.safeParse({
				synonym: [relationId("Laufen"), relationId("Laufen")],
			}).success,
		).toBe(true);
		expect(
			LexicalRelationsSchema.safeParse({
				synonym: [false],
			}).success,
		).toBe(false);
	});

	it("exposes total inverse relation helpers", () => {
		expect(getInverseLexicalRelation("hypernym")).toBe("hyponym");
		expect(getInverseLexicalRelation("synonym")).toBe("synonym");
		expect(getInverseMorphologicalRelation("derivedFrom")).toBe(
			"sourceFor",
		);
		expect(getInverseMorphologicalRelation("usedIn")).toBe("consistsOf");
	});
});
