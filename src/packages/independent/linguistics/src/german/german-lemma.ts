import z from "zod/v3";
import type { LemmaSchemaLanguageShape } from "../registry-shapes";
import { GermanNounLemmaSchema } from "./lu/lexeme/noun/german-noun-bundle";
import { GermanVerbLemmaSchema } from "./lu/lexeme/verb/german-verb-bundle";

const AnySchema = z.any();

export const GermanLemmaSchema = {
	Lexeme: {
		ADJ: AnySchema,
		ADP: AnySchema,
		ADV: AnySchema,
		AUX: AnySchema,
		CCONJ: AnySchema,
		DET: AnySchema,
		INTJ: AnySchema,
		NOUN: GermanNounLemmaSchema,
		NUM: AnySchema,
		PART: AnySchema,
		PRON: AnySchema,
		PROPN: AnySchema,
		PUNCT: AnySchema,
		SCONJ: AnySchema,
		SYM: AnySchema,
		VERB: GermanVerbLemmaSchema,
		X: AnySchema,
	},
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
