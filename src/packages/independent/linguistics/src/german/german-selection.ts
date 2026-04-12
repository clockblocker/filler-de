import z from "zod/v3";
import type { SelectionSchemaLanguageShape } from "../registry-shapes";
import type { AbstractSelectionFor } from "../universal/abstract-selection";
import {
	GermanStandardInflectionLexemeSelectionSchemas,
	GermanStandardLemmaLexemeSelectionSchemas,
	GermanStandardPartialLexemeSelectionSchemas,
	GermanStandardVariantLexemeSelectionSchemas,
	GermanTypoInflectionLexemeSelectionSchemas,
	GermanTypoLemmaLexemeSelectionSchemas,
	GermanTypoPartialLexemeSelectionSchemas,
	GermanTypoVariantLexemeSelectionSchemas,
} from "./lu/lexeme/german-lexemes";
import {
	GermanStandardLemmaMorphemeSelectionSchemas,
	GermanTypoLemmaMorphemeSelectionSchemas,
} from "./lu/morpheme/german-morphemes";
import {
	GermanStandardLemmaPhrasemeSelectionSchemas,
	GermanTypoLemmaPhrasemeSelectionSchemas,
} from "./lu/phraseme/german-phrasemes";

const GermanUnknownSelectionSchema = z.object({
	orthographicStatus: z.literal("Unknown"),
}) satisfies z.ZodType<AbstractSelectionFor<"Unknown">>;

type asdd = AbstractSelectionFor<"Unknown">;

export const GermanSelectionSchema = {
	Standard: {
		Inflection: {
			Lexeme: GermanStandardInflectionLexemeSelectionSchemas,
		},
		Lemma: {
			Lexeme: GermanStandardLemmaLexemeSelectionSchemas,
			Morpheme: GermanStandardLemmaMorphemeSelectionSchemas,
			Phraseme: GermanStandardLemmaPhrasemeSelectionSchemas,
		},
		Partial: {
			Lexeme: GermanStandardPartialLexemeSelectionSchemas,
		},
		Variant: {
			Lexeme: GermanStandardVariantLexemeSelectionSchemas,
		},
	},
	Typo: {
		Inflection: {
			Lexeme: GermanTypoInflectionLexemeSelectionSchemas,
		},
		Lemma: {
			Lexeme: GermanTypoLemmaLexemeSelectionSchemas,
			Morpheme: GermanTypoLemmaMorphemeSelectionSchemas,
			Phraseme: GermanTypoLemmaPhrasemeSelectionSchemas,
		},
		Partial: {
			Lexeme: GermanTypoPartialLexemeSelectionSchemas,
		},
		Variant: {
			Lexeme: GermanTypoVariantLexemeSelectionSchemas,
		},
	},
	Unknown: GermanUnknownSelectionSchema,
} satisfies SelectionSchemaLanguageShape;
