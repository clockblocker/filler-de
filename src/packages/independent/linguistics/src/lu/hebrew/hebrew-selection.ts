import z from "zod/v3";
import type { SelectionSchemaLanguageShape } from "../registry-shapes";
import type { SelectionSchemaFor } from "../universal/helpers/schema-targets";
import {
	HebrewStandardInflectionLexemeSelectionSchemas,
	HebrewStandardLemmaLexemeSelectionSchemas,
	HebrewStandardVariantLexemeSelectionSchemas,
	HebrewTypoInflectionLexemeSelectionSchemas,
	HebrewTypoLemmaLexemeSelectionSchemas,
	HebrewTypoVariantLexemeSelectionSchemas,
} from "./lu/lexeme/hebrew-lexemes";
import {
	HebrewStandardLemmaMorphemeSelectionSchemas,
	HebrewTypoLemmaMorphemeSelectionSchemas,
} from "./lu/morpheme/hebrew-morphemes";
import {
	HebrewStandardLemmaPhrasemeSelectionSchemas,
	HebrewTypoLemmaPhrasemeSelectionSchemas,
} from "./lu/phraseme/hebrew-phrasemes";

const HebrewUnknownSelectionSchema = z.object({
	language: z.literal("Hebrew"),
	orthographicStatus: z.literal("Unknown"),
	spelledSelection: z.string(),
}) satisfies SelectionSchemaFor<"Unknown">;

export const HebrewSelectionSchema = {
	Standard: {
		Inflection: {
			Lexeme: HebrewStandardInflectionLexemeSelectionSchemas,
		},
		Lemma: {
			Lexeme: HebrewStandardLemmaLexemeSelectionSchemas,
			Morpheme: HebrewStandardLemmaMorphemeSelectionSchemas,
			Phraseme: HebrewStandardLemmaPhrasemeSelectionSchemas,
		},
		Variant: {
			Lexeme: HebrewStandardVariantLexemeSelectionSchemas,
		},
	},
	Typo: {
		Inflection: {
			Lexeme: HebrewTypoInflectionLexemeSelectionSchemas,
		},
		Lemma: {
			Lexeme: HebrewTypoLemmaLexemeSelectionSchemas,
			Morpheme: HebrewTypoLemmaMorphemeSelectionSchemas,
			Phraseme: HebrewTypoLemmaPhrasemeSelectionSchemas,
		},
		Variant: {
			Lexeme: HebrewTypoVariantLexemeSelectionSchemas,
		},
	},
	Unknown: HebrewUnknownSelectionSchema,
} satisfies SelectionSchemaLanguageShape;
