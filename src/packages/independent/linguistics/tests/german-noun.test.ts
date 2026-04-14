import { describe, expect, it } from "bun:test";
import type { Lemma } from "../src";
import {
	LemmaSchema,
	LexicalRelationsSchema,
	MorphologicalRelationsSchema,
	SelectionSchema,
} from "../src";
import {
	GermanNounInflectionSelectionSchema,
	GermanNounLemmaSchema,
	GermanNounLemmaSelectionSchema,
	GermanNounStandardPartialSelectionSchema,
	GermanNounTypoInflectionSelectionSchema,
} from "../src/lu/german/lu/lexeme/noun/german-noun-bundle";

const relationId = (label: string) => `rel:${label}`;

function nounSurface(spelledLemma: string) {
	return {
		discriminators: {
			lemmaKind: "Lexeme" as const,
			lemmaSubKind: "NOUN" as const,
		},
		target: {
			spelledLemma,
		},
	};
}

describe("German noun schemas", () => {
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
				...nounSurface("Kind"),
				inflectionalFeatures: {
					case: "Dat",
					number: "Plur",
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
				...nounSurface("Kind"),
				inflectionalFeatures: {
					case: "Ins",
					number: "Dual",
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
			meaningInEmojis: "👶",
			spelledLemma: "Kind",
		});

		expect(result.success).toBe(true);
	});

	it("validates relation payloads via the dedicated relation schemas", () => {
		expect(
			LexicalRelationsSchema.safeParse({
				hypernym: [relationId("Lebewesen")],
				synonym: [relationId("Nachkomme")],
			}).success,
		).toBe(true);
		expect(
			MorphologicalRelationsSchema.safeParse({
				derivedFrom: [relationId("Kind")],
				sourceFor: [relationId("Kindheit")],
			}).success,
		).toBe(true);
	});

	it("rejects invalid meaningInEmojis payloads", () => {
		const lemmaResult = GermanNounLemmaSchema.safeParse({
			inherentFeatures: {},
			language: "German",
			lemmaKind: "Lexeme",
			pos: "NOUN",
			meaningInEmojis: "",
			spelledLemma: "Haus",
		});
		const selectionResult = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				spelledSurface: "Haus",
				surfaceKind: "Lemma",
				target: {
					lemma: {
						inherentFeatures: {},
						language: "German",
						lemmaKind: "Lexeme",
						meaningInEmojis: "house",
						pos: "NOUN",
						spelledLemma: "Haus",
					},
				},
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
				...nounSurface("Hauptbahnhof"),
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
				...nounSurface("Hund"),
				inflectionalFeatures: {
					case: "Gen",
					number: "Sing",
				},
				spelledSurface: "Hun des",
				surfaceKind: "Inflection",
			},
		});

		expect(result.success).toBe(true);
	});

	it("accepts duplicate relation ids and rejects non-string relation payloads", () => {
		expect(
			LexicalRelationsSchema.safeParse({
				synonym: [relationId("Auto"), relationId("Auto")],
			}).success,
		).toBe(true);
		expect(
			LexicalRelationsSchema.safeParse({
				synonym: [123],
			}).success,
		).toBe(false);
	});

	it("accepts detached and hydrated lemma targets", () => {
		const detached = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				...nounSurface("Haus"),
				spelledSurface: "Haus",
				surfaceKind: "Lemma",
			},
		});
		const hydrated = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				spelledSurface: "Haus",
				surfaceKind: "Lemma",
				target: {
					lemma: {
						inherentFeatures: {
							gender: "Neut",
						},
						language: "German",
						lemmaKind: "Lexeme",
						pos: "NOUN",
						spelledLemma: "Haus",
					},
				},
			},
		});

		expect(detached.success).toBe(true);
		expect(hydrated.success).toBe(true);
	});

	it("rejects hydrated lemma mismatches on language, lemmaKind, and lemmaSubKind", () => {
		const wrongLanguage = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				spelledSurface: "Haus",
				surfaceKind: "Lemma",
				target: {
					lemma: {
						inherentFeatures: {},
						language: "English",
						lemmaKind: "Lexeme",
						pos: "NOUN",
						spelledLemma: "Haus",
					},
				},
			},
		});
		const wrongKind = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				spelledSurface: "Haus",
				surfaceKind: "Lemma",
				target: {
					lemma: {
						language: "German",
						lemmaKind: "Phraseme",
						phrasemeKind: "Cliché",
						spelledLemma: "Haus",
					},
				},
			},
		});
		const wrongSubKind = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				spelledSurface: "Haus",
				surfaceKind: "Lemma",
				target: {
					lemma: {
						inherentFeatures: {},
						language: "German",
						lemmaKind: "Lexeme",
						pos: "VERB",
						spelledLemma: "Haus",
					},
				},
			},
		});

		expect(wrongLanguage.success).toBe(false);
		expect(wrongKind.success).toBe(false);
		expect(wrongSubKind.success).toBe(false);
	});

	it("rejects invalid target unions and non-inflectional feature leakage", () => {
		const bothTargetFields = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				...nounSurface("Haus"),
				spelledSurface: "Haus",
				surfaceKind: "Lemma",
				target: {
					lemma: {
						inherentFeatures: {
							gender: "Neut",
						},
						language: "German",
						lemmaKind: "Lexeme",
						pos: "NOUN",
						spelledLemma: "Haus",
					},
					spelledLemma: "Haus",
				},
			},
		});
		const missingTarget = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				spelledSurface: "Haus",
				surfaceKind: "Lemma",
			},
		});
		const leakedFeatures = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				...nounSurface("Haus"),
				inflectionalFeatures: {
					case: "Nom",
				},
				spelledSurface: "Haus",
				surfaceKind: "Lemma",
			},
		});

		expect(bothTargetFields.success).toBe(false);
		expect(missingTarget.success).toBe(false);
		expect(leakedFeatures.success).toBe(false);
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
