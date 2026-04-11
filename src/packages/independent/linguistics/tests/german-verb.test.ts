import { describe, expect, it } from "bun:test";
import {
	GermanVerbInflectionSelectionSchema,
	GermanVerbLemmaSchema,
} from "../src/german/lu/lexeme/pos/german-verb";

describe("German verb schemas", () => {
	it("accepts supported German verb inflectional features", () => {
		const result = GermanVerbInflectionSelectionSchema.safeParse({
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
			pos: "VERB",
		});

		expect(result.success).toBe(true);
	});

	it("rejects unsupported inherent feature keys", () => {
		const result = GermanVerbLemmaSchema.safeParse({
			inherentFeatures: {
				mood: "Ind",
			},
			pos: "VERB",
		});

		expect(result.success).toBe(false);
	});
});
