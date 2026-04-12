import { describe, expect, it } from "bun:test";
import { LemmaSchema, SelectionSchema } from "../src";
import type { Lemma } from "../src";
import {
	GermanNounInflectionSelectionSchema,
	GermanNounLemmaSchema,
	GermanNounLemmaSelectionSchema,
	GermanNounStandardPartialSelectionSchema,
	GermanNounTypoInflectionSelectionSchema,
} from "../src/german/lu/lexeme/noun/german-noun-bundle";

describe("German noun schemas", () => {
	it("exposes inferred lemma types from the registry", () => {
		const lemma: Lemma<"German", "Lexeme", "NOUN"> = {
			inherentFeatures: {
				gender: "Neut",
			},
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "NOUN",
		};

		expect(lemma.pos).toBe("NOUN");
	});

	it("accepts supported German noun inflectional features", () => {
		const result = GermanNounInflectionSelectionSchema.safeParse({
			orthographicStatus: "Standard",
			surface: {
				inflectionalFeatures: {
					case: "Dat",
					number: "Plur",
				},
				lemma: {
					emojiDescription: ["👶"],
					lemmaKind: "Lexeme",
					pos: "NOUN",
					spelledLemma: "Kind",
				},
				spelledSurface: "Kindern",
				surfaceKind: "Inflection",
			},
		});

		expect(result.success).toBe(true);
	});

	it("rejects unsupported UD values for German noun inflection", () => {
		const result = GermanNounInflectionSelectionSchema.safeParse({
			orthographicStatus: "Standard",
			surface: {
				inflectionalFeatures: {
					case: "Ins",
					number: "Dual",
				},
				lemma: {
					lemmaKind: "Lexeme",
					pos: "NOUN",
					spelledLemma: "Kind",
				},
				spelledSurface: "Kindern",
				surfaceKind: "Inflection",
			},
		});

		expect(result.success).toBe(false);
	});

	it("accepts lexical inherent features for German nouns", () => {
		const result = GermanNounLemmaSchema.safeParse({
			emojiDescription: ["👶"],
			inherentFeatures: {
				gender: "Neut",
			},
			lexicalRelations: {
				hypernym: ["Lebewesen"],
				synonym: ["Nachkomme"],
			},
			morphologicalRelations: {
				derivedFrom: ["kind"],
				sourceFor: ["Kindheit"],
			},
			pos: "NOUN",
		});

		expect(result.success).toBe(true);
	});

	it("rejects invalid emoji descriptions", () => {
		const lemmaResult = GermanNounLemmaSchema.safeParse({
			emojiDescription: [],
			inherentFeatures: {},
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "NOUN",
		});
		const selectionResult = GermanNounLemmaSelectionSchema.safeParse({
			orthographicStatus: "Standard",
			surface: {
				lemma: {
					emojiDescription: ["house"],
					lemmaKind: "Lexeme",
					pos: "NOUN",
					spelledLemma: "Haus",
				},
				spelledSurface: "Haus",
				surfaceKind: "Lemma",
			},
		});

		expect(lemmaResult.success).toBe(false);
		expect(selectionResult.success).toBe(false);
	});

	it("rejects unsupported inherent feature keys", () => {
		const result = GermanNounLemmaSchema.safeParse({
			inherentFeatures: {
				case: "Nom",
			},
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "NOUN",
		});

		expect(result.success).toBe(false);
	});

	it("accepts partial selections without inflectional features", () => {
		const result = GermanNounStandardPartialSelectionSchema.safeParse({
			orthographicStatus: "Standard",
			surface: {
				lemma: {
					lemmaKind: "Lexeme",
					pos: "NOUN",
					spelledLemma: "Hauptbahnhof",
				},
				spelledSurface: "Bahnhof",
				surfaceKind: "Partial",
			},
		});

		expect(result.success).toBe(true);
	});

	it("accepts typo inflection selections with the typo discriminant", () => {
		const result = GermanNounTypoInflectionSelectionSchema.safeParse({
			orthographicStatus: "Typo",
			surface: {
				inflectionalFeatures: {
					case: "Gen",
					number: "Sing",
				},
				lemma: {
					lemmaKind: "Lexeme",
					pos: "NOUN",
					spelledLemma: "Hund",
				},
				spelledSurface: "Hun des",
				surfaceKind: "Inflection",
			},
		});

		expect(result.success).toBe(true);
	});

	it("rejects duplicate relation targets", () => {
		const result = GermanNounLemmaSchema.safeParse({
			inherentFeatures: {},
			lexicalRelations: {
				synonym: ["Auto", "Auto"],
			},
			morphologicalRelations: {},
			pos: "NOUN",
		});

		expect(result.success).toBe(false);
	});

	it("exposes registry access for German nouns", () => {
		expect(SelectionSchema.German.Standard.Inflection.Lexeme.NOUN).toBe(
			GermanNounInflectionSelectionSchema,
		);
		expect(SelectionSchema.German.Standard.Partial.Lexeme.NOUN).toBe(
			GermanNounStandardPartialSelectionSchema,
		);
		expect(SelectionSchema.German.Typo.Inflection.Lexeme.NOUN).toBe(
			GermanNounTypoInflectionSelectionSchema,
		);
		expect(LemmaSchema.German.Lexeme.NOUN).toBe(GermanNounLemmaSchema);
	});
});
