import z from "zod/v3";
import type { LemmaSchemaLanguageShape } from "../registry-shapes";
import { GermanLexemeLemmaSchemas } from "./lu/lexeme/german-lexemes";

const AnySchema = z.any();

export const GermanLemmaSchema = {
	Lexeme: GermanLexemeLemmaSchemas,
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
} satisfies LemmaSchemaLanguageShape;
