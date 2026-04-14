import { describe, expect, it } from "bun:test";
import {
	getInverseLexicalRelation,
	getInverseMorphologicalRelation,
	LexicalRelationsSchema,
	MorphologicalRelationsSchema,
	SelectionSchema,
} from "../src";
import {
	GermanVerbInflectionSelectionSchema,
	GermanVerbLemmaSchema,
	GermanVerbStandardPartialSelectionSchema,
	GermanVerbTypoInflectionSelectionSchema,
} from "../src/lu/german/lu/lexeme/verb/german-verb-bundle";

const relationId = (label: string) => `rel:${label}`;

function verbSurface(spelledLemma: string) {
	return {
		discriminators: {
			lemmaKind: "Lexeme" as const,
			lemmaSubKind: "VERB" as const,
		},
		target: {
			spelledLemma,
		},
	};
}

describe("German verb schemas", () => {
	it("accepts supported German verb inflectional features", () => {
		const result = GermanVerbInflectionSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				...verbSurface("gehen"),
				inflectionalFeatures: {
					mood: "Sub",
					number: "Sing",
					person: "3",
					tense: "Past",
					verbForm: "Fin",
				},
				spelledSurface: "ging",
				surfaceKind: "Inflection",
			},
		});

		expect(result.success).toBe(true);
	});

	it("rejects unsupported UD values for German verb inflection", () => {
		const result = GermanVerbInflectionSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				...verbSurface("gehen"),
				inflectionalFeatures: {
					mood: "Cnd",
					number: "Dual",
					person: "4",
					tense: "Fut",
					verbForm: "Ger",
				},
				spelledSurface: "gehend",
				surfaceKind: "Inflection",
			},
		});

		expect(result.success).toBe(false);
	});

	it("accepts lexical inherent features for German verbs", () => {
		const result = GermanVerbLemmaSchema.safeParse({
			inherentFeatures: {
				governedPreposition: "auf",
				isPhrasal: false,
				reflex: true,
				separable: false,
			},
			language: "German",
			lemmaKind: "Lexeme",
			pos: "VERB",
			spelledLemma: "gehen",
		});

		expect(result.success).toBe(true);
	});

	it("accepts the new verb-specific lexical features and rejects empty governed prepositions", () => {
		expect(
			GermanVerbLemmaSchema.safeParse({
				inherentFeatures: {
					governedPreposition: "mit",
					isPhrasal: true,
				},
				language: "German",
				lemmaKind: "Lexeme",
				pos: "VERB",
				spelledLemma: "mitkommen",
			}).success,
		).toBe(true);

		expect(
			GermanVerbLemmaSchema.safeParse({
				inherentFeatures: {
					governedPreposition: "",
				},
				language: "German",
				lemmaKind: "Lexeme",
				pos: "VERB",
				spelledLemma: "warten",
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
		const result = GermanVerbLemmaSchema.safeParse({
			inherentFeatures: {
				mood: "Ind",
			},
			language: "German",
			lemmaKind: "Lexeme",
			pos: "VERB",
			spelledLemma: "gehen",
		});

		expect(result.success).toBe(false);
	});

	it("accepts partial selections without inflectional features", () => {
		const result = GermanVerbStandardPartialSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				...verbSurface("spazieren gehen"),
				spelledSurface: "gehen",
				surfaceKind: "Partial",
			},
		});

		expect(result.success).toBe(true);
	});

	it("accepts typo inflection selections with the typo discriminant", () => {
		const result = GermanVerbTypoInflectionSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Typo",
			surface: {
				...verbSurface("gehen"),
				inflectionalFeatures: {
					mood: "Ind",
					number: "Sing",
					person: "1",
					tense: "Pres",
					verbForm: "Fin",
				},
				spelledSurface: "geheh",
				surfaceKind: "Inflection",
			},
		});

		expect(result.success).toBe(true);
	});

	it("accepts unknown selections without a surface", () => {
		const result = SelectionSchema.German.Unknown.safeParse({
			language: "German",
			orthographicStatus: "Unknown",
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
