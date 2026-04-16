import { describe, expect, it } from "bun:test";
import { lingSchemaFor } from "../../src";
import {
	englishWalkResolvedLemmaSelection,
	englishWalkStandardFullSelection,
	hebrewKatvuUnresolvedInflectionSurface,
} from "../helpers";

describe("selection spelling relation", () => {
	it("accepts lemma selections marked as spelling variants", () => {
		const result =
			lingSchemaFor.Selection.English.Standard.Lemma.Lexeme.VERB.safeParse(
				{
					...englishWalkResolvedLemmaSelection,
					spellingRelation: "Variant",
				},
			);

		expect(result.success).toBe(true);
	});

	it("accepts inflection selections marked as spelling variants", () => {
		const result =
			lingSchemaFor.Selection.English.Standard.Inflection.Lexeme.VERB.safeParse(
				{
					...englishWalkStandardFullSelection,
					spellingRelation: "Variant",
				},
			);

		expect(result.success).toBe(true);
	});

	it("accepts Hebrew pointed inflection variants without variant surface kinds", () => {
		const result =
			lingSchemaFor.Selection.Hebrew.Standard.Inflection.Lexeme.VERB.safeParse(
				{
					language: "Hebrew",
					orthographicStatus: "Standard",
					selectionCoverage: "Full",
					spelledSelection: "כָּתְבוּ",
					spellingRelation: "Variant",
					surface: {
						...hebrewKatvuUnresolvedInflectionSurface,
						normalizedFullSurface: "כָּתְבוּ",
					},
				},
			);

		expect(result.success).toBe(true);
	});

	it("rejects legacy surfaceKind variant payloads", () => {
		const result =
			lingSchemaFor.Selection.English.Standard.Lemma.Lexeme.VERB.safeParse(
				{
					...englishWalkResolvedLemmaSelection,
					spellingRelation: "Variant",
					surface: {
						...englishWalkResolvedLemmaSelection.surface,
						surfaceKind: "Variant",
					},
				},
			);

		expect(result.success).toBe(false);
	});

	it("keeps unknown selections free of spelling metadata", () => {
		const result = lingSchemaFor.Selection.English.Unknown.safeParse({
			language: "English",
			orthographicStatus: "Unknown",
			spelledSelection: "colour",
			spellingRelation: "Variant",
		});

		expect(result.success).toBe(false);
	});
});
