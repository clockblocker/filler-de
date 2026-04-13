import z from "zod/v3";
import type { SelectionSchemaLanguageShape } from "../registry-shapes";
import type { AbstractSelectionFor } from "../universal/abstract-selection";
import {
	EnglishStandardInflectionLexemeSelectionSchemas,
	EnglishStandardLemmaLexemeSelectionSchemas,
	EnglishStandardPartialLexemeSelectionSchemas,
	EnglishStandardVariantLexemeSelectionSchemas,
	EnglishTypoInflectionLexemeSelectionSchemas,
	EnglishTypoLemmaLexemeSelectionSchemas,
	EnglishTypoPartialLexemeSelectionSchemas,
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
	orthographicStatus: z.literal("Unknown"),
}) satisfies z.ZodType<AbstractSelectionFor<"Unknown">>;

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
		Partial: {
			Lexeme: EnglishStandardPartialLexemeSelectionSchemas,
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
		Partial: {
			Lexeme: EnglishTypoPartialLexemeSelectionSchemas,
		},
		Variant: {
			Lexeme: EnglishTypoVariantLexemeSelectionSchemas,
		},
	},
	Unknown: EnglishUnknownSelectionSchema,
} satisfies SelectionSchemaLanguageShape;
