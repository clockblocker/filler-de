import { describe, expect, it } from "bun:test";
import {
	GermanVerbInflectionSelectionSchema,
	GermanVerbLemmaSchema,
	GermanVerbStandardPartialSelectionSchema,
	GermanVerbTypoInflectionSelectionSchema,
} from "../src/german/lu/lexeme/verb/german-verb-bundle";
import { LemmaSchema, SelectionSchema } from "../src";
import { getInverseLexicalRelation } from "../src/universal/enums/relation/lexical";
import { getInverseMorphologicalRelation } from "../src/universal/enums/relation/morphological";

describe("German verb schemas", () => {
	it("accepts supported German verb inflectional features", () => {
		const result = GermanVerbInflectionSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				inflectionalFeatures: {
					mood: "Sub",
					number: "Sing",
					person: "3",
					tense: "Past",
					verbForm: "Fin",
				},
				lemma: {
					lemmaKind: "Lexeme",
					language: "German",
					pos: "VERB",
					spelledLemma: "gehen",
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
				inflectionalFeatures: {
					mood: "Cnd",
					number: "Dual",
					person: "4",
					tense: "Fut",
					verbForm: "Ger",
				},
				lemma: {
					lemmaKind: "Lexeme",
					language: "German",
					pos: "VERB",
					spelledLemma: "gehen",
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
				reflex: true,
				separable: false,
			},
			language: "German",
			lexicalRelations: {
				hypernym: ["Fortbewegung"],
				synonym: ["laufen"],
			},
			morphologicalRelations: {
				derivedFrom: ["Gang"],
				sourceFor: ["Ausgang"],
			},
			pos: "VERB",
			spelledLemma: "gehen",
		});

		expect(result.success).toBe(true);
	});

	it("rejects unsupported inherent feature keys", () => {
		const result = GermanVerbLemmaSchema.safeParse({
			inherentFeatures: {
				mood: "Ind",
			},
			language: "German",
			lexicalRelations: {},
			morphologicalRelations: {},
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
				lemma: {
					lemmaKind: "Lexeme",
					language: "German",
					pos: "VERB",
					spelledLemma: "spazieren gehen",
				},
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
				inflectionalFeatures: {
					mood: "Ind",
					number: "Sing",
					person: "1",
					tense: "Pres",
					verbForm: "Fin",
				},
				lemma: {
					lemmaKind: "Lexeme",
					language: "German",
					pos: "VERB",
					spelledLemma: "gehen",
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

	it("rejects duplicate relation targets", () => {
		const result = GermanVerbLemmaSchema.safeParse({
			inherentFeatures: {},
			language: "German",
			lexicalRelations: {
				synonym: ["laufen", "laufen"],
			},
			morphologicalRelations: {},
			pos: "VERB",
			spelledLemma: "laufen",
		});

		expect(result.success).toBe(false);
	});

	it("exposes total inverse relation helpers", () => {
		expect(getInverseLexicalRelation("hypernym")).toBe("hyponym");
		expect(getInverseLexicalRelation("synonym")).toBe("synonym");
		expect(getInverseMorphologicalRelation("derivedFrom")).toBe(
			"sourceFor",
		);
		expect(getInverseMorphologicalRelation("usedIn")).toBe("consistsOf");
	});

	it("exposes registry access for German verbs", () => {
		expect(SelectionSchema.German.Standard.Inflection.Lexeme.VERB).toBe(
			GermanVerbInflectionSelectionSchema,
		);
		expect(SelectionSchema.German.Standard.Partial.Lexeme.VERB).toBe(
			GermanVerbStandardPartialSelectionSchema,
		);
		expect(SelectionSchema.German.Typo.Inflection.Lexeme.VERB).toBe(
			GermanVerbTypoInflectionSelectionSchema,
		);
		expect(LemmaSchema.German.Lexeme.VERB).toBe(GermanVerbLemmaSchema);
	});
});
