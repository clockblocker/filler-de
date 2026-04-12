import z from "zod/v3";
import type { LemmaSchemaLanguageShape } from "../registry-shapes";
import { GermanAdjectiveLemmaSchema } from "./lu/lexeme/adjective/german-adjective-bundle";
import { GermanAdpositionLemmaSchema } from "./lu/lexeme/adposition/german-adposition-bundle";
import { GermanAdverbLemmaSchema } from "./lu/lexeme/adverb/german-adverb-bundle";
import { GermanAuxiliaryLemmaSchema } from "./lu/lexeme/auxiliary/german-auxiliary-bundle";
import { GermanCoordinatingConjunctionLemmaSchema } from "./lu/lexeme/coordinating-conjunction/german-coordinating-conjunction-bundle";
import { GermanDeterminerLemmaSchema } from "./lu/lexeme/determiner/german-determiner-bundle";
import { GermanInterjectionLemmaSchema } from "./lu/lexeme/interjection/german-interjection-bundle";
import { GermanNounLemmaSchema } from "./lu/lexeme/noun/german-noun-bundle";
import { GermanNumeralLemmaSchema } from "./lu/lexeme/numeral/german-numeral-bundle";
import { GermanOtherLemmaSchema } from "./lu/lexeme/other/german-other-bundle";
import { GermanParticleLemmaSchema } from "./lu/lexeme/particle/german-particle-bundle";
import { GermanPronounLemmaSchema } from "./lu/lexeme/pronoun/german-pronoun-bundle";
import { GermanProperNounLemmaSchema } from "./lu/lexeme/proper-noun/german-proper-noun-bundle";
import { GermanPunctuationLemmaSchema } from "./lu/lexeme/punctuation/german-punctuation-bundle";
import { GermanSubordinatingConjunctionLemmaSchema } from "./lu/lexeme/subordinating-conjunction/german-subordinating-conjunction-bundle";
import { GermanSymbolLemmaSchema } from "./lu/lexeme/symbol/german-symbol-bundle";
import { GermanVerbLemmaSchema } from "./lu/lexeme/verb/german-verb-bundle";

const AnySchema = z.any();
const GermanLexemeLemmaSchemas = {
	ADJ: GermanAdjectiveLemmaSchema,
	ADP: GermanAdpositionLemmaSchema,
	ADV: GermanAdverbLemmaSchema,
	AUX: GermanAuxiliaryLemmaSchema,
	CCONJ: GermanCoordinatingConjunctionLemmaSchema,
	DET: GermanDeterminerLemmaSchema,
	INTJ: GermanInterjectionLemmaSchema,
	NOUN: GermanNounLemmaSchema,
	NUM: GermanNumeralLemmaSchema,
	PART: GermanParticleLemmaSchema,
	PRON: GermanPronounLemmaSchema,
	PROPN: GermanProperNounLemmaSchema,
	PUNCT: GermanPunctuationLemmaSchema,
	SCONJ: GermanSubordinatingConjunctionLemmaSchema,
	SYM: GermanSymbolLemmaSchema,
	VERB: GermanVerbLemmaSchema,
	X: GermanOtherLemmaSchema,
} satisfies LemmaSchemaLanguageShape["Lexeme"];

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
