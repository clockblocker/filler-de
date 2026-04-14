import z from "zod/v3";
import type { SelectionSchemaLanguageShape } from "../registry-shapes";
import type { AbstractSelectionFor } from "../universal/abstract-selection";
import {
	GermanStandardInflectionLexemeSelectionSchemas,
	GermanStandardLemmaLexemeSelectionSchemas,
	GermanStandardVariantLexemeSelectionSchemas,
	GermanTypoInflectionLexemeSelectionSchemas,
	GermanTypoLemmaLexemeSelectionSchemas,
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
	language: z.literal("German"),
	orthographicStatus: z.literal("Unknown"),
	spelledSelection: z.string(),
}) satisfies z.ZodType<AbstractSelectionFor<"Unknown">>;

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
		Variant: {
			Lexeme: GermanTypoVariantLexemeSelectionSchemas,
		},
	},
	Unknown: GermanUnknownSelectionSchema,
} satisfies SelectionSchemaLanguageShape;
