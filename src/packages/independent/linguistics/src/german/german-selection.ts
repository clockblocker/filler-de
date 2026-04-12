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

const AnySchema = z.any();

const GermanUnknownSelectionSchema = z.object({
	orthographicStatus: z.literal("Unknown"),
}) satisfies z.ZodType<AbstractSelectionFor<"Unknown">>;

export const GermanSelectionSchema = {
	Standard: {
		Inflection: {
			Lexeme: GermanStandardInflectionLexemeSelectionSchemas,
			Morpheme: {
				Circumfix: AnySchema,
				Clitic: AnySchema,
				Duplifix: AnySchema,
				Infix: AnySchema,
				Interfix: AnySchema,
				Prefix: AnySchema,
				Root: AnySchema,
				Suffix: AnySchema,
				Suffixoid: AnySchema,
				ToneMarking: AnySchema,
				Transfix: AnySchema,
			},
			Phraseme: {
				Aphorism: AnySchema,
				Cliché: AnySchema,
				DiscourseFormula: AnySchema,
			},
		},
		Lemma: {
			Lexeme: GermanStandardLemmaLexemeSelectionSchemas,
			Morpheme: {
				Circumfix: AnySchema,
				Clitic: AnySchema,
				Duplifix: AnySchema,
				Infix: AnySchema,
				Interfix: AnySchema,
				Prefix: AnySchema,
				Root: AnySchema,
				Suffix: AnySchema,
				Suffixoid: AnySchema,
				ToneMarking: AnySchema,
				Transfix: AnySchema,
			},
			Phraseme: {
				Aphorism: AnySchema,
				Cliché: AnySchema,
				DiscourseFormula: AnySchema,
			},
		},
		Partial: {
			Lexeme: GermanStandardPartialLexemeSelectionSchemas,
			Morpheme: {
				Circumfix: AnySchema,
				Clitic: AnySchema,
				Duplifix: AnySchema,
				Infix: AnySchema,
				Interfix: AnySchema,
				Prefix: AnySchema,
				Root: AnySchema,
				Suffix: AnySchema,
				Suffixoid: AnySchema,
				ToneMarking: AnySchema,
				Transfix: AnySchema,
			},
			Phraseme: {
				Aphorism: AnySchema,
				Cliché: AnySchema,
				DiscourseFormula: AnySchema,
			},
		},
		Variant: {
			Lexeme: GermanStandardVariantLexemeSelectionSchemas,
			Morpheme: {
				Circumfix: AnySchema,
				Clitic: AnySchema,
				Duplifix: AnySchema,
				Infix: AnySchema,
				Interfix: AnySchema,
				Prefix: AnySchema,
				Root: AnySchema,
				Suffix: AnySchema,
				Suffixoid: AnySchema,
				ToneMarking: AnySchema,
				Transfix: AnySchema,
			},
			Phraseme: {
				Aphorism: AnySchema,
				Cliché: AnySchema,
				DiscourseFormula: AnySchema,
			},
		},
	},
	Typo: {
		Inflection: {
			Lexeme: GermanTypoInflectionLexemeSelectionSchemas,
			Morpheme: {
				Circumfix: AnySchema,
				Clitic: AnySchema,
				Duplifix: AnySchema,
				Infix: AnySchema,
				Interfix: AnySchema,
				Prefix: AnySchema,
				Root: AnySchema,
				Suffix: AnySchema,
				Suffixoid: AnySchema,
				ToneMarking: AnySchema,
				Transfix: AnySchema,
			},
			Phraseme: {
				Aphorism: AnySchema,
				Cliché: AnySchema,
				DiscourseFormula: AnySchema,
			},
		},
		Lemma: {
			Lexeme: GermanTypoLemmaLexemeSelectionSchemas,
			Morpheme: {
				Circumfix: AnySchema,
				Clitic: AnySchema,
				Duplifix: AnySchema,
				Infix: AnySchema,
				Interfix: AnySchema,
				Prefix: AnySchema,
				Root: AnySchema,
				Suffix: AnySchema,
				Suffixoid: AnySchema,
				ToneMarking: AnySchema,
				Transfix: AnySchema,
			},
			Phraseme: {
				Aphorism: AnySchema,
				Cliché: AnySchema,
				DiscourseFormula: AnySchema,
			},
		},
		Partial: {
			Lexeme: GermanTypoPartialLexemeSelectionSchemas,
			Morpheme: {
				Circumfix: AnySchema,
				Clitic: AnySchema,
				Duplifix: AnySchema,
				Infix: AnySchema,
				Interfix: AnySchema,
				Prefix: AnySchema,
				Root: AnySchema,
				Suffix: AnySchema,
				Suffixoid: AnySchema,
				ToneMarking: AnySchema,
				Transfix: AnySchema,
			},
			Phraseme: {
				Aphorism: AnySchema,
				Cliché: AnySchema,
				DiscourseFormula: AnySchema,
			},
		},
		Variant: {
			Lexeme: GermanTypoVariantLexemeSelectionSchemas,
			Morpheme: {
				Circumfix: AnySchema,
				Clitic: AnySchema,
				Duplifix: AnySchema,
				Infix: AnySchema,
				Interfix: AnySchema,
				Prefix: AnySchema,
				Root: AnySchema,
				Suffix: AnySchema,
				Suffixoid: AnySchema,
				ToneMarking: AnySchema,
				Transfix: AnySchema,
			},
			Phraseme: {
				Aphorism: AnySchema,
				Cliché: AnySchema,
				DiscourseFormula: AnySchema,
			},
		},
	},
	Unknown: GermanUnknownSelectionSchema,
} satisfies SelectionSchemaLanguageShape;
