import { describe, expect, it } from "bun:test";
import {
	getInverseLexicalRelation,
	getInverseMorphologicalRelation,
	LexicalRelationsSchema,
	MorphologicalRelationsSchema,
	SelectionSchema,
} from "../../src";
import { GermanVerbSchemas } from "../../src/lu/german/lu/lexeme/pos/verb/german-verb-bundle";

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
				isPhrasal: false,
				reflex: true,
				separable: false,
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🚶",
			pos: "VERB",
		});

		expect(result.success).toBe(true);
	});

	it("accepts the new verb-specific lexical features and rejects empty governed prepositions", () => {
		expect(
			GermanVerbSchemas.LemmaSchema.safeParse({
				canonicalLemma: "mitkommen",
				inherentFeatures: {
					governedPreposition: "mit",
					isPhrasal: true,
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
					governedPreposition: "",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "⏳",
				pos: "VERB",
			}).success,
		).toBe(false);
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
			orthographicStatus: "Standard",
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
