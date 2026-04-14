import { describe, expect, it } from "bun:test";
import type { Lemma } from "../../src";
import {
	LemmaSchema,
	LexicalRelationsSchema,
	MorphologicalRelationsSchema,
	SelectionSchema,
} from "../../src";
import {
	GermanNounInflectionSelectionSchema,
	GermanNounLemmaSchema,
	GermanNounLemmaSelectionSchema,
	GermanNounTypoInflectionSelectionSchema,
} from "../../src/lu/german/lu/lexeme/noun/german-noun-bundle";

const relationId = (label: string) => `rel:${label}`;

function nounSurface(canonicalLemma: string) {
	return {
		discriminators: {
			lemmaKind: "Lexeme" as const,
			lemmaSubKind: "NOUN" as const,
		},
		target: {
			canonicalLemma,
		},
	};
}

describe("German noun schemas", () => {
	it("exposes inferred lemma types from the registry", () => {
		const lemma = {
			canonicalLemma: "Kind",
			inherentFeatures: {
				gender: "Neut",
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "👶",
			pos: "NOUN",
		} satisfies Lemma<"German", "Lexeme", "NOUN">;

		expect(lemma.pos).toBe("NOUN");
	});

	it("accepts supported German noun inflectional features", () => {
		const result = GermanNounInflectionSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			spelledSelection: "Kindern",
			surface: {
				...nounSurface("Kind"),
				inflectionalFeatures: {
					case: "Dat",
					number: "Plur",
				},
				normalizedFullSurface: "Kindern",
				surfaceKind: "Inflection",
			},
		});

		expect(result.success).toBe(true);
	});

	it("rejects unsupported UD values for German noun inflection", () => {
		const result = GermanNounInflectionSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			spelledSelection: "Kindern",
			surface: {
				...nounSurface("Kind"),
				inflectionalFeatures: {
					case: "Ins",
					number: "Dual",
				},
				normalizedFullSurface: "Kindern",
				surfaceKind: "Inflection",
			},
		});

		expect(result.success).toBe(false);
	});

	it("accepts lexical inherent features for German nouns", () => {
		const result = GermanNounLemmaSchema.safeParse({
			canonicalLemma: "Kind",
			inherentFeatures: {
				gender: "Neut",
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "👶",
			pos: "NOUN",
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
			canonicalLemma: "Haus",
			inherentFeatures: {},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "",
			pos: "NOUN",
		});
		const selectionResult = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			spelledSelection: "Haus",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				normalizedFullSurface: "Haus",
				surfaceKind: "Lemma",
				target: {
					lemma: {
						canonicalLemma: "Haus",
						inherentFeatures: {},
						language: "German",
						lemmaKind: "Lexeme",
						meaningInEmojis: "house",
						pos: "NOUN",
					},
				},
			},
		});

		expect(lemmaResult.success).toBe(false);
		expect(selectionResult.success).toBe(false);
	});

	it("rejects unsupported inherent feature keys", () => {
		const result = GermanNounLemmaSchema.safeParse({
			canonicalLemma: "Kind",
			inherentFeatures: {
				case: "Nom",
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "👶",
			pos: "NOUN",
		});

		expect(result.success).toBe(false);
	});

	it("accepts lemma selections where the spelled selection covers only part of the full surface", () => {
		const result = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			spelledSelection: "Bahnhof",
			surface: {
				...nounSurface("Hauptbahnhof"),
				normalizedFullSurface: "Hauptbahnhof",
				surfaceKind: "Lemma",
			},
		});

		expect(result.success).toBe(true);
	});

	it("accepts typo inflection selections with the typo discriminant", () => {
		const result = GermanNounTypoInflectionSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Typo",
			spelledSelection: "Hun des",
			surface: {
				...nounSurface("Hund"),
				inflectionalFeatures: {
					case: "Gen",
					number: "Sing",
				},
				normalizedFullSurface: "Hun des",
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
			spelledSelection: "Haus",
			surface: {
				...nounSurface("Haus"),
				normalizedFullSurface: "Haus",
				surfaceKind: "Lemma",
			},
		});
		const hydrated = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			spelledSelection: "Haus",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				normalizedFullSurface: "Haus",
				surfaceKind: "Lemma",
				target: {
					lemma: {
						canonicalLemma: "Haus",
						inherentFeatures: {
							gender: "Neut",
						},
						language: "German",
						lemmaKind: "Lexeme",
						meaningInEmojis: "🏠",
						pos: "NOUN",
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
			spelledSelection: "Haus",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				normalizedFullSurface: "Haus",
				surfaceKind: "Lemma",
				target: {
					lemma: {
						canonicalLemma: "Haus",
						inherentFeatures: {},
						language: "English",
						lemmaKind: "Lexeme",
						meaningInEmojis: "🏠",
						pos: "NOUN",
					},
				},
			},
		});
		const wrongKind = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			spelledSelection: "Haus",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				normalizedFullSurface: "Haus",
				surfaceKind: "Lemma",
				target: {
					lemma: {
						canonicalLemma: "Haus",
						language: "German",
						lemmaKind: "Phraseme",
						meaningInEmojis: "🏠",
						phrasemeKind: "Cliché",
					},
				},
			},
		});
		const wrongSubKind = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			spelledSelection: "Haus",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				normalizedFullSurface: "Haus",
				surfaceKind: "Lemma",
				target: {
					lemma: {
						canonicalLemma: "Haus",
						inherentFeatures: {},
						language: "German",
						lemmaKind: "Lexeme",
						meaningInEmojis: "🏠",
						pos: "VERB",
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
			spelledSelection: "Haus",
			surface: {
				...nounSurface("Haus"),
				normalizedFullSurface: "Haus",
				surfaceKind: "Lemma",
				target: {
					canonicalLemma: "Haus",
					lemma: {
						canonicalLemma: "Haus",
						inherentFeatures: {
							gender: "Neut",
						},
						language: "German",
						lemmaKind: "Lexeme",
						meaningInEmojis: "🏠",
						pos: "NOUN",
					},
				},
			},
		});
		const missingTarget = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			spelledSelection: "Haus",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				normalizedFullSurface: "Haus",
				surfaceKind: "Lemma",
			},
		});
		const leakedFeatures = GermanNounLemmaSelectionSchema.safeParse({
			language: "German",
			orthographicStatus: "Standard",
			spelledSelection: "Haus",
			surface: {
				...nounSurface("Haus"),
				inflectionalFeatures: {
					case: "Nom",
				},
				normalizedFullSurface: "Haus",
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
		expect(SelectionSchema.German.Standard.Lemma.Lexeme.NOUN).toBe(
			GermanNounLemmaSelectionSchema,
		);
		expect(SelectionSchema.German.Typo.Inflection.Lexeme.NOUN).toBe(
			GermanNounTypoInflectionSelectionSchema,
		);
		expect(LemmaSchema.German.Lexeme.NOUN).toBe(GermanNounLemmaSchema);
	});
});
