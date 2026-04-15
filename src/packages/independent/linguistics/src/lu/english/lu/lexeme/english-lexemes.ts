import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "../../../registry-shapes";
import { EnglishAdjectiveSchemas } from "./pos/adjective/english-adjective-bundle";
import { EnglishAdpositionSchemas } from "./pos/adposition/english-adposition-bundle";
import { EnglishAdverbSchemas } from "./pos/adverb/english-adverb-bundle";
import { EnglishAuxiliarySchemas } from "./pos/auxiliary/english-auxiliary-bundle";
import { EnglishCoordinatingConjunctionSchemas } from "./pos/coordinating-conjunction/english-coordinating-conjunction-bundle";
import { EnglishDeterminerSchemas } from "./pos/determiner/english-determiner-bundle";
import { EnglishInterjectionSchemas } from "./pos/interjection/english-interjection-bundle";
import { EnglishNounSchemas } from "./pos/noun/english-noun-bundle";
import { EnglishNumeralSchemas } from "./pos/numeral/english-numeral-bundle";
import { EnglishOtherSchemas } from "./pos/other/english-other-bundle";
import { EnglishParticleSchemas } from "./pos/particle/english-particle-bundle";
import { EnglishPronounSchemas } from "./pos/pronoun/english-pronoun-bundle";
import { EnglishProperNounSchemas } from "./pos/proper-noun/english-proper-noun-bundle";
import { EnglishPunctuationSchemas } from "./pos/punctuation/english-punctuation-bundle";
import { EnglishSubordinatingConjunctionSchemas } from "./pos/subordinating-conjunction/english-subordinating-conjunction-bundle";
import { EnglishSymbolSchemas } from "./pos/symbol/english-symbol-bundle";
import { EnglishVerbSchemas } from "./pos/verb/english-verb-bundle";

export const EnglishLexemeLemmaSchemas = {
	ADJ: EnglishAdjectiveSchemas.LemmaSchema,
	ADP: EnglishAdpositionSchemas.LemmaSchema,
	ADV: EnglishAdverbSchemas.LemmaSchema,
	AUX: EnglishAuxiliarySchemas.LemmaSchema,
	CCONJ: EnglishCoordinatingConjunctionSchemas.LemmaSchema,
	DET: EnglishDeterminerSchemas.LemmaSchema,
	INTJ: EnglishInterjectionSchemas.LemmaSchema,
	NOUN: EnglishNounSchemas.LemmaSchema,
	NUM: EnglishNumeralSchemas.LemmaSchema,
	PART: EnglishParticleSchemas.LemmaSchema,
	PRON: EnglishPronounSchemas.LemmaSchema,
	PROPN: EnglishProperNounSchemas.LemmaSchema,
	PUNCT: EnglishPunctuationSchemas.LemmaSchema,
	SCONJ: EnglishSubordinatingConjunctionSchemas.LemmaSchema,
	SYM: EnglishSymbolSchemas.LemmaSchema,
	VERB: EnglishVerbSchemas.LemmaSchema,
	X: EnglishOtherSchemas.LemmaSchema,
} satisfies LemmaSchemaLanguageShape["Lexeme"];

export const EnglishStandardInflectionLexemeSelectionSchemas = {
	ADJ: EnglishAdjectiveSchemas.InflectionSelectionSchema,
	ADP: EnglishAdpositionSchemas.InflectionSelectionSchema,
	ADV: EnglishAdverbSchemas.InflectionSelectionSchema,
	AUX: EnglishAuxiliarySchemas.InflectionSelectionSchema,
	CCONJ: EnglishCoordinatingConjunctionSchemas.InflectionSelectionSchema,
	DET: EnglishDeterminerSchemas.InflectionSelectionSchema,
	INTJ: EnglishInterjectionSchemas.InflectionSelectionSchema,
	NOUN: EnglishNounSchemas.InflectionSelectionSchema,
	NUM: EnglishNumeralSchemas.InflectionSelectionSchema,
	PART: EnglishParticleSchemas.InflectionSelectionSchema,
	PRON: EnglishPronounSchemas.InflectionSelectionSchema,
	PROPN: EnglishProperNounSchemas.InflectionSelectionSchema,
	PUNCT: EnglishPunctuationSchemas.InflectionSelectionSchema,
	SCONJ: EnglishSubordinatingConjunctionSchemas.InflectionSelectionSchema,
	SYM: EnglishSymbolSchemas.InflectionSelectionSchema,
	VERB: EnglishVerbSchemas.InflectionSelectionSchema,
	X: EnglishOtherSchemas.InflectionSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Inflection"]["Lexeme"];

export const EnglishStandardLemmaLexemeSelectionSchemas = {
	ADJ: EnglishAdjectiveSchemas.LemmaSelectionSchema,
	ADP: EnglishAdpositionSchemas.LemmaSelectionSchema,
	ADV: EnglishAdverbSchemas.LemmaSelectionSchema,
	AUX: EnglishAuxiliarySchemas.LemmaSelectionSchema,
	CCONJ: EnglishCoordinatingConjunctionSchemas.LemmaSelectionSchema,
	DET: EnglishDeterminerSchemas.LemmaSelectionSchema,
	INTJ: EnglishInterjectionSchemas.LemmaSelectionSchema,
	NOUN: EnglishNounSchemas.LemmaSelectionSchema,
	NUM: EnglishNumeralSchemas.LemmaSelectionSchema,
	PART: EnglishParticleSchemas.LemmaSelectionSchema,
	PRON: EnglishPronounSchemas.LemmaSelectionSchema,
	PROPN: EnglishProperNounSchemas.LemmaSelectionSchema,
	PUNCT: EnglishPunctuationSchemas.LemmaSelectionSchema,
	SCONJ: EnglishSubordinatingConjunctionSchemas.LemmaSelectionSchema,
	SYM: EnglishSymbolSchemas.LemmaSelectionSchema,
	VERB: EnglishVerbSchemas.LemmaSelectionSchema,
	X: EnglishOtherSchemas.LemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Lemma"]["Lexeme"];

export const EnglishStandardVariantLexemeSelectionSchemas = {
	ADJ: EnglishAdjectiveSchemas.StandardVariantSelectionSchema,
	ADP: EnglishAdpositionSchemas.StandardVariantSelectionSchema,
	ADV: EnglishAdverbSchemas.StandardVariantSelectionSchema,
	AUX: EnglishAuxiliarySchemas.StandardVariantSelectionSchema,
	CCONJ: EnglishCoordinatingConjunctionSchemas.StandardVariantSelectionSchema,
	DET: EnglishDeterminerSchemas.StandardVariantSelectionSchema,
	INTJ: EnglishInterjectionSchemas.StandardVariantSelectionSchema,
	NOUN: EnglishNounSchemas.StandardVariantSelectionSchema,
	NUM: EnglishNumeralSchemas.StandardVariantSelectionSchema,
	PART: EnglishParticleSchemas.StandardVariantSelectionSchema,
	PRON: EnglishPronounSchemas.StandardVariantSelectionSchema,
	PROPN: EnglishProperNounSchemas.StandardVariantSelectionSchema,
	PUNCT: EnglishPunctuationSchemas.StandardVariantSelectionSchema,
	SCONJ: EnglishSubordinatingConjunctionSchemas.StandardVariantSelectionSchema,
	SYM: EnglishSymbolSchemas.StandardVariantSelectionSchema,
	VERB: EnglishVerbSchemas.StandardVariantSelectionSchema,
	X: EnglishOtherSchemas.StandardVariantSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Variant"]["Lexeme"];

export const EnglishTypoInflectionLexemeSelectionSchemas = {
	ADJ: EnglishAdjectiveSchemas.TypoInflectionSelectionSchema,
	ADP: EnglishAdpositionSchemas.TypoInflectionSelectionSchema,
	ADV: EnglishAdverbSchemas.TypoInflectionSelectionSchema,
	AUX: EnglishAuxiliarySchemas.TypoInflectionSelectionSchema,
	CCONJ: EnglishCoordinatingConjunctionSchemas.TypoInflectionSelectionSchema,
	DET: EnglishDeterminerSchemas.TypoInflectionSelectionSchema,
	INTJ: EnglishInterjectionSchemas.TypoInflectionSelectionSchema,
	NOUN: EnglishNounSchemas.TypoInflectionSelectionSchema,
	NUM: EnglishNumeralSchemas.TypoInflectionSelectionSchema,
	PART: EnglishParticleSchemas.TypoInflectionSelectionSchema,
	PRON: EnglishPronounSchemas.TypoInflectionSelectionSchema,
	PROPN: EnglishProperNounSchemas.TypoInflectionSelectionSchema,
	PUNCT: EnglishPunctuationSchemas.TypoInflectionSelectionSchema,
	SCONJ: EnglishSubordinatingConjunctionSchemas.TypoInflectionSelectionSchema,
	SYM: EnglishSymbolSchemas.TypoInflectionSelectionSchema,
	VERB: EnglishVerbSchemas.TypoInflectionSelectionSchema,
	X: EnglishOtherSchemas.TypoInflectionSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Inflection"]["Lexeme"];

export const EnglishTypoLemmaLexemeSelectionSchemas = {
	ADJ: EnglishAdjectiveSchemas.TypoLemmaSelectionSchema,
	ADP: EnglishAdpositionSchemas.TypoLemmaSelectionSchema,
	ADV: EnglishAdverbSchemas.TypoLemmaSelectionSchema,
	AUX: EnglishAuxiliarySchemas.TypoLemmaSelectionSchema,
	CCONJ: EnglishCoordinatingConjunctionSchemas.TypoLemmaSelectionSchema,
	DET: EnglishDeterminerSchemas.TypoLemmaSelectionSchema,
	INTJ: EnglishInterjectionSchemas.TypoLemmaSelectionSchema,
	NOUN: EnglishNounSchemas.TypoLemmaSelectionSchema,
	NUM: EnglishNumeralSchemas.TypoLemmaSelectionSchema,
	PART: EnglishParticleSchemas.TypoLemmaSelectionSchema,
	PRON: EnglishPronounSchemas.TypoLemmaSelectionSchema,
	PROPN: EnglishProperNounSchemas.TypoLemmaSelectionSchema,
	PUNCT: EnglishPunctuationSchemas.TypoLemmaSelectionSchema,
	SCONJ: EnglishSubordinatingConjunctionSchemas.TypoLemmaSelectionSchema,
	SYM: EnglishSymbolSchemas.TypoLemmaSelectionSchema,
	VERB: EnglishVerbSchemas.TypoLemmaSelectionSchema,
	X: EnglishOtherSchemas.TypoLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Lemma"]["Lexeme"];

export const EnglishTypoVariantLexemeSelectionSchemas = {
	ADJ: EnglishAdjectiveSchemas.TypoVariantSelectionSchema,
	ADP: EnglishAdpositionSchemas.TypoVariantSelectionSchema,
	ADV: EnglishAdverbSchemas.TypoVariantSelectionSchema,
	AUX: EnglishAuxiliarySchemas.TypoVariantSelectionSchema,
	CCONJ: EnglishCoordinatingConjunctionSchemas.TypoVariantSelectionSchema,
	DET: EnglishDeterminerSchemas.TypoVariantSelectionSchema,
	INTJ: EnglishInterjectionSchemas.TypoVariantSelectionSchema,
	NOUN: EnglishNounSchemas.TypoVariantSelectionSchema,
	NUM: EnglishNumeralSchemas.TypoVariantSelectionSchema,
	PART: EnglishParticleSchemas.TypoVariantSelectionSchema,
	PRON: EnglishPronounSchemas.TypoVariantSelectionSchema,
	PROPN: EnglishProperNounSchemas.TypoVariantSelectionSchema,
	PUNCT: EnglishPunctuationSchemas.TypoVariantSelectionSchema,
	SCONJ: EnglishSubordinatingConjunctionSchemas.TypoVariantSelectionSchema,
	SYM: EnglishSymbolSchemas.TypoVariantSelectionSchema,
	VERB: EnglishVerbSchemas.TypoVariantSelectionSchema,
	X: EnglishOtherSchemas.TypoVariantSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Variant"]["Lexeme"];
