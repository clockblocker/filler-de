import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "../../../registry-shapes";
import { HebrewAdjectiveSchemas } from "./pos/hebrew-adjective";
import { HebrewAdpositionSchemas } from "./pos/hebrew-adposition";
import { HebrewAdverbSchemas } from "./pos/hebrew-adverb";
import { HebrewAuxiliarySchemas } from "./pos/hebrew-auxiliary";
import { HebrewCoordinatingConjunctionSchemas } from "./pos/hebrew-coordinating-conjunction";
import { HebrewDeterminerSchemas } from "./pos/hebrew-determiner";
import { HebrewInterjectionSchemas } from "./pos/hebrew-interjection";
import { HebrewNounSchemas } from "./pos/hebrew-noun";
import { HebrewNumeralSchemas } from "./pos/hebrew-numeral";
import { HebrewOtherSchemas } from "./pos/hebrew-other";
import { HebrewPronounSchemas } from "./pos/hebrew-pronoun";
import { HebrewProperNounSchemas } from "./pos/hebrew-proper-noun";
import { HebrewPunctuationSchemas } from "./pos/hebrew-punctuation";
import { HebrewSubordinatingConjunctionSchemas } from "./pos/hebrew-subordinating-conjunction";
import { HebrewSymbolSchemas } from "./pos/hebrew-symbol";
import { HebrewVerbSchemas } from "./pos/hebrew-verb";

export const HebrewLexemeLemmaSchemas = {
	ADJ: HebrewAdjectiveSchemas.LemmaSchema,
	ADP: HebrewAdpositionSchemas.LemmaSchema,
	ADV: HebrewAdverbSchemas.LemmaSchema,
	AUX: HebrewAuxiliarySchemas.LemmaSchema,
	CCONJ: HebrewCoordinatingConjunctionSchemas.LemmaSchema,
	DET: HebrewDeterminerSchemas.LemmaSchema,
	INTJ: HebrewInterjectionSchemas.LemmaSchema,
	NOUN: HebrewNounSchemas.LemmaSchema,
	NUM: HebrewNumeralSchemas.LemmaSchema,
	PRON: HebrewPronounSchemas.LemmaSchema,
	PROPN: HebrewProperNounSchemas.LemmaSchema,
	PUNCT: HebrewPunctuationSchemas.LemmaSchema,
	SCONJ: HebrewSubordinatingConjunctionSchemas.LemmaSchema,
	SYM: HebrewSymbolSchemas.LemmaSchema,
	VERB: HebrewVerbSchemas.LemmaSchema,
	X: HebrewOtherSchemas.LemmaSchema,
} as unknown as LemmaSchemaLanguageShape["Lexeme"];

export const HebrewStandardInflectionLexemeSelectionSchemas = {
	ADJ: HebrewAdjectiveSchemas.InflectionSelectionSchema,
	ADP: HebrewAdpositionSchemas.InflectionSelectionSchema,
	ADV: HebrewAdverbSchemas.InflectionSelectionSchema,
	AUX: HebrewAuxiliarySchemas.InflectionSelectionSchema,
	CCONJ: HebrewCoordinatingConjunctionSchemas.InflectionSelectionSchema,
	DET: HebrewDeterminerSchemas.InflectionSelectionSchema,
	INTJ: HebrewInterjectionSchemas.InflectionSelectionSchema,
	NOUN: HebrewNounSchemas.InflectionSelectionSchema,
	NUM: HebrewNumeralSchemas.InflectionSelectionSchema,
	PRON: HebrewPronounSchemas.InflectionSelectionSchema,
	PROPN: HebrewProperNounSchemas.InflectionSelectionSchema,
	PUNCT: HebrewPunctuationSchemas.InflectionSelectionSchema,
	SCONJ: HebrewSubordinatingConjunctionSchemas.InflectionSelectionSchema,
	SYM: HebrewSymbolSchemas.InflectionSelectionSchema,
	VERB: HebrewVerbSchemas.InflectionSelectionSchema,
	X: HebrewOtherSchemas.InflectionSelectionSchema,
} as unknown as SelectionSchemaLanguageShape["Standard"]["Inflection"]["Lexeme"];

export const HebrewStandardLemmaLexemeSelectionSchemas = {
	ADJ: HebrewAdjectiveSchemas.LemmaSelectionSchema,
	ADP: HebrewAdpositionSchemas.LemmaSelectionSchema,
	ADV: HebrewAdverbSchemas.LemmaSelectionSchema,
	AUX: HebrewAuxiliarySchemas.LemmaSelectionSchema,
	CCONJ: HebrewCoordinatingConjunctionSchemas.LemmaSelectionSchema,
	DET: HebrewDeterminerSchemas.LemmaSelectionSchema,
	INTJ: HebrewInterjectionSchemas.LemmaSelectionSchema,
	NOUN: HebrewNounSchemas.LemmaSelectionSchema,
	NUM: HebrewNumeralSchemas.LemmaSelectionSchema,
	PRON: HebrewPronounSchemas.LemmaSelectionSchema,
	PROPN: HebrewProperNounSchemas.LemmaSelectionSchema,
	PUNCT: HebrewPunctuationSchemas.LemmaSelectionSchema,
	SCONJ: HebrewSubordinatingConjunctionSchemas.LemmaSelectionSchema,
	SYM: HebrewSymbolSchemas.LemmaSelectionSchema,
	VERB: HebrewVerbSchemas.LemmaSelectionSchema,
	X: HebrewOtherSchemas.LemmaSelectionSchema,
} as unknown as SelectionSchemaLanguageShape["Standard"]["Lemma"]["Lexeme"];

export const HebrewStandardVariantLexemeSelectionSchemas = {
	ADJ: HebrewAdjectiveSchemas.StandardVariantSelectionSchema,
	ADP: HebrewAdpositionSchemas.StandardVariantSelectionSchema,
	ADV: HebrewAdverbSchemas.StandardVariantSelectionSchema,
	AUX: HebrewAuxiliarySchemas.StandardVariantSelectionSchema,
	CCONJ: HebrewCoordinatingConjunctionSchemas.StandardVariantSelectionSchema,
	DET: HebrewDeterminerSchemas.StandardVariantSelectionSchema,
	INTJ: HebrewInterjectionSchemas.StandardVariantSelectionSchema,
	NOUN: HebrewNounSchemas.StandardVariantSelectionSchema,
	NUM: HebrewNumeralSchemas.StandardVariantSelectionSchema,
	PRON: HebrewPronounSchemas.StandardVariantSelectionSchema,
	PROPN: HebrewProperNounSchemas.StandardVariantSelectionSchema,
	PUNCT: HebrewPunctuationSchemas.StandardVariantSelectionSchema,
	SCONJ: HebrewSubordinatingConjunctionSchemas.StandardVariantSelectionSchema,
	SYM: HebrewSymbolSchemas.StandardVariantSelectionSchema,
	VERB: HebrewVerbSchemas.StandardVariantSelectionSchema,
	X: HebrewOtherSchemas.StandardVariantSelectionSchema,
} as unknown as SelectionSchemaLanguageShape["Standard"]["Variant"]["Lexeme"];

export const HebrewTypoInflectionLexemeSelectionSchemas = {
	ADJ: HebrewAdjectiveSchemas.TypoInflectionSelectionSchema,
	ADP: HebrewAdpositionSchemas.TypoInflectionSelectionSchema,
	ADV: HebrewAdverbSchemas.TypoInflectionSelectionSchema,
	AUX: HebrewAuxiliarySchemas.TypoInflectionSelectionSchema,
	CCONJ: HebrewCoordinatingConjunctionSchemas.TypoInflectionSelectionSchema,
	DET: HebrewDeterminerSchemas.TypoInflectionSelectionSchema,
	INTJ: HebrewInterjectionSchemas.TypoInflectionSelectionSchema,
	NOUN: HebrewNounSchemas.TypoInflectionSelectionSchema,
	NUM: HebrewNumeralSchemas.TypoInflectionSelectionSchema,
	PRON: HebrewPronounSchemas.TypoInflectionSelectionSchema,
	PROPN: HebrewProperNounSchemas.TypoInflectionSelectionSchema,
	PUNCT: HebrewPunctuationSchemas.TypoInflectionSelectionSchema,
	SCONJ: HebrewSubordinatingConjunctionSchemas.TypoInflectionSelectionSchema,
	SYM: HebrewSymbolSchemas.TypoInflectionSelectionSchema,
	VERB: HebrewVerbSchemas.TypoInflectionSelectionSchema,
	X: HebrewOtherSchemas.TypoInflectionSelectionSchema,
} as unknown as SelectionSchemaLanguageShape["Typo"]["Inflection"]["Lexeme"];

export const HebrewTypoLemmaLexemeSelectionSchemas = {
	ADJ: HebrewAdjectiveSchemas.TypoLemmaSelectionSchema,
	ADP: HebrewAdpositionSchemas.TypoLemmaSelectionSchema,
	ADV: HebrewAdverbSchemas.TypoLemmaSelectionSchema,
	AUX: HebrewAuxiliarySchemas.TypoLemmaSelectionSchema,
	CCONJ: HebrewCoordinatingConjunctionSchemas.TypoLemmaSelectionSchema,
	DET: HebrewDeterminerSchemas.TypoLemmaSelectionSchema,
	INTJ: HebrewInterjectionSchemas.TypoLemmaSelectionSchema,
	NOUN: HebrewNounSchemas.TypoLemmaSelectionSchema,
	NUM: HebrewNumeralSchemas.TypoLemmaSelectionSchema,
	PRON: HebrewPronounSchemas.TypoLemmaSelectionSchema,
	PROPN: HebrewProperNounSchemas.TypoLemmaSelectionSchema,
	PUNCT: HebrewPunctuationSchemas.TypoLemmaSelectionSchema,
	SCONJ: HebrewSubordinatingConjunctionSchemas.TypoLemmaSelectionSchema,
	SYM: HebrewSymbolSchemas.TypoLemmaSelectionSchema,
	VERB: HebrewVerbSchemas.TypoLemmaSelectionSchema,
	X: HebrewOtherSchemas.TypoLemmaSelectionSchema,
} as unknown as SelectionSchemaLanguageShape["Typo"]["Lemma"]["Lexeme"];

export const HebrewTypoVariantLexemeSelectionSchemas = {
	ADJ: HebrewAdjectiveSchemas.TypoVariantSelectionSchema,
	ADP: HebrewAdpositionSchemas.TypoVariantSelectionSchema,
	ADV: HebrewAdverbSchemas.TypoVariantSelectionSchema,
	AUX: HebrewAuxiliarySchemas.TypoVariantSelectionSchema,
	CCONJ: HebrewCoordinatingConjunctionSchemas.TypoVariantSelectionSchema,
	DET: HebrewDeterminerSchemas.TypoVariantSelectionSchema,
	INTJ: HebrewInterjectionSchemas.TypoVariantSelectionSchema,
	NOUN: HebrewNounSchemas.TypoVariantSelectionSchema,
	NUM: HebrewNumeralSchemas.TypoVariantSelectionSchema,
	PRON: HebrewPronounSchemas.TypoVariantSelectionSchema,
	PROPN: HebrewProperNounSchemas.TypoVariantSelectionSchema,
	PUNCT: HebrewPunctuationSchemas.TypoVariantSelectionSchema,
	SCONJ: HebrewSubordinatingConjunctionSchemas.TypoVariantSelectionSchema,
	SYM: HebrewSymbolSchemas.TypoVariantSelectionSchema,
	VERB: HebrewVerbSchemas.TypoVariantSelectionSchema,
	X: HebrewOtherSchemas.TypoVariantSelectionSchema,
} as unknown as SelectionSchemaLanguageShape["Typo"]["Variant"]["Lexeme"];
