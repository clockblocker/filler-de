import z from "zod/v3";
import type { LemmaSchemaLanguageShape } from "../registry-shapes";

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
		NOUN: AnySchema,
		NUM: AnySchema,
		PART: AnySchema,
		PRON: AnySchema,
		PROPN: AnySchema,
		PUNCT: AnySchema,
		SCONJ: AnySchema,
		SYM: AnySchema,
		VERB: AnySchema,
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
