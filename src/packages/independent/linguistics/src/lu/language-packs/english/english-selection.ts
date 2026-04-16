import z from "zod/v3";
import type { SelectionSchemaLanguageShape } from "../../registry-shapes";
import type { SelectionSchemaFor } from "../../universal/helpers/schema-targets";
import {
	EnglishStandardInflectionLexemeSelectionSchemas,
	EnglishStandardLemmaLexemeSelectionSchemas,
	EnglishStandardVariantLexemeSelectionSchemas,
	EnglishTypoInflectionLexemeSelectionSchemas,
	EnglishTypoLemmaLexemeSelectionSchemas,
	EnglishTypoVariantLexemeSelectionSchemas,
} from "./lu/lexeme/english-lexemes";
import {
	EnglishStandardLemmaMorphemeSelectionSchemas,
	EnglishTypoLemmaMorphemeSelectionSchemas,
} from "./lu/morpheme/english-morphemes";
import {
	EnglishStandardLemmaPhrasemeSelectionSchemas,
	EnglishTypoLemmaPhrasemeSelectionSchemas,
} from "./lu/phraseme/english-phrasemes";

const EnglishUnknownSelectionSchema = z.object({
	language: z.literal("English"),
	orthographicStatus: z.literal("Unknown"),
	spelledSelection: z.string(),
}) satisfies SelectionSchemaFor<"Unknown">;

export const EnglishSelectionSchema = {
	Standard: {
		Inflection: {
			Lexeme: EnglishStandardInflectionLexemeSelectionSchemas,
		},
		Lemma: {
			Lexeme: EnglishStandardLemmaLexemeSelectionSchemas,
			Morpheme: EnglishStandardLemmaMorphemeSelectionSchemas,
			Phraseme: EnglishStandardLemmaPhrasemeSelectionSchemas,
		},
		Variant: {
			Lexeme: EnglishStandardVariantLexemeSelectionSchemas,
		},
	},
	Typo: {
		Inflection: {
			Lexeme: EnglishTypoInflectionLexemeSelectionSchemas,
		},
		Lemma: {
			Lexeme: EnglishTypoLemmaLexemeSelectionSchemas,
			Morpheme: EnglishTypoLemmaMorphemeSelectionSchemas,
			Phraseme: EnglishTypoLemmaPhrasemeSelectionSchemas,
		},
		Variant: {
			Lexeme: EnglishTypoVariantLexemeSelectionSchemas,
		},
	},
	Unknown: EnglishUnknownSelectionSchema,
} satisfies SelectionSchemaLanguageShape;
