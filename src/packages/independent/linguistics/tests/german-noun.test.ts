import { describe, expect, it } from "bun:test";
import type { Lemma } from "../src";
import {
	LemmaSchema,
	LexicalRelationsSchema,
	MorphologicalRelationsSchema,
	SelectionSchema,
	toLingId,
} from "../src";
import {
	GermanNounInflectionSelectionSchema,
	GermanNounLemmaSchema,
	GermanNounLemmaSelectionSchema,
	GermanNounStandardPartialSelectionSchema,
	GermanNounTypoInflectionSelectionSchema,
} from "../src/lu/german/lu/lexeme/noun/german-noun-bundle";

describe("German noun schemas", () => {
	const germanNounLingId = (spelledLemma: string) => {
		const lingId = toLingId({
			inherentFeatures: { gender: "Neut" },
			language: "German",
			lemmaKind: "Lexeme",
			pos: "NOUN",
			spelledLemma,
		});

		expect(lingId).not.toBeNull();
		return lingId;
	};

	it("exposes inferred lemma types from the registry", () => {
		const lemma: Lemma<"German", "Lexeme", "NOUN"> = {
			inherentFeatures: {
				gender: "Neut",
			},
			language: "German",
			lemmaKind: "Lexeme",
			pos: "NOUN",
			spelledLemma: "Kind",
		};

		expect(lemma.pos).toBe("NOUN");
	});

	it("accepts supported German noun inflectional features", () => {
		const result = GermanNounInflectionSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				inflectionalFeatures: {
					case: "Dat",
					number: "Plur",
				},
				lemma: {
					language: "German",
					lemmaKind: "Lexeme",
					pos: "NOUN",
					senseEmojis: ["👶"],
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
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				inflectionalFeatures: {
					case: "Ins",
					number: "Dual",
				},
				lemma: {
					language: "German",
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
			inherentFeatures: {
				gender: "Neut",
			},
			language: "German",
			lemmaKind: "Lexeme",
			pos: "NOUN",
			senseEmojis: ["👶"],
			spelledLemma: "Kind",
		});

		expect(result.success).toBe(true);
	});

	it("validates relation payloads via the dedicated relation schemas", () => {
		const lebewesen = germanNounLingId("Lebewesen");
		const nachkomme = germanNounLingId("Nachkomme");
		const kind = germanNounLingId("Kind");
		const kindheit = germanNounLingId("Kindheit");

		expect(
			LexicalRelationsSchema.safeParse({
				hypernym: [lebewesen],
				synonym: [nachkomme],
			}).success,
		).toBe(true);
		expect(
			MorphologicalRelationsSchema.safeParse({
				derivedFrom: [kind],
				sourceFor: [kindheit],
			}).success,
		).toBe(true);
	});

	it("rejects invalid sense emoji payloads", () => {
		const lemmaResult = GermanNounLemmaSchema.safeParse({
			inherentFeatures: {},
			language: "German",
			lemmaKind: "Lexeme",
			pos: "NOUN",
			senseEmojis: [],
			spelledLemma: "Haus",
		});
		const selectionResult = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				lemma: {
					language: "German",
					lemmaKind: "Lexeme",
					pos: "NOUN",
					senseEmojis: ["house"],
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
			language: "German",
			lemmaKind: "Lexeme",
			pos: "NOUN",
			spelledLemma: "Kind",
		});

		expect(result.success).toBe(false);
	});

	it("accepts partial selections without inflectional features", () => {
		const result = GermanNounStandardPartialSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				lemma: {
					language: "German",
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
			language: "German",
			orthographicStatus: "Typo",
			surface: {
				inflectionalFeatures: {
					case: "Gen",
					number: "Sing",
				},
				lemma: {
					language: "German",
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

	it("accepts duplicate relation lemma ids", () => {
		const auto = germanNounLingId("Auto");

		const result = LexicalRelationsSchema.safeParse({
			synonym: [auto, auto],
		});

		expect(result.success).toBe(true);
	});

	it("rejects raw lemma strings in relation payloads", () => {
		const result = LexicalRelationsSchema.safeParse({
			synonym: ["Auto"],
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
