import z from "zod/v3";
import type { LemmaSchemaLanguageShape } from "../registry-shapes";
import { GermanLexemePosSchemas } from "./lu/lexeme/pos/german-pos-schemas";

const AnySchema = z.any();

export const GermanLemmaSchema = {
	Lexeme: {
		ADJ: GermanLexemePosSchemas.ADJ.lemmaSchema,
		ADP: GermanLexemePosSchemas.ADP.lemmaSchema,
		ADV: GermanLexemePosSchemas.ADV.lemmaSchema,
		AUX: GermanLexemePosSchemas.AUX.lemmaSchema,
		CCONJ: GermanLexemePosSchemas.CCONJ.lemmaSchema,
		DET: GermanLexemePosSchemas.DET.lemmaSchema,
		INTJ: GermanLexemePosSchemas.INTJ.lemmaSchema,
		NOUN: GermanLexemePosSchemas.NOUN.lemmaSchema,
		NUM: GermanLexemePosSchemas.NUM.lemmaSchema,
		PART: GermanLexemePosSchemas.PART.lemmaSchema,
		PRON: GermanLexemePosSchemas.PRON.lemmaSchema,
		PROPN: GermanLexemePosSchemas.PROPN.lemmaSchema,
		PUNCT: GermanLexemePosSchemas.PUNCT.lemmaSchema,
		SCONJ: GermanLexemePosSchemas.SCONJ.lemmaSchema,
		SYM: GermanLexemePosSchemas.SYM.lemmaSchema,
		VERB: GermanLexemePosSchemas.VERB.lemmaSchema,
		X: GermanLexemePosSchemas.X.lemmaSchema,
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
