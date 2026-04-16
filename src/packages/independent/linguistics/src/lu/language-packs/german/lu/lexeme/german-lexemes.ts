import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "../../../../registry-shapes";
import { GermanAdjectiveSchemas } from "./pos/german-adjective";
import { GermanAdpositionSchemas } from "./pos/german-adposition";
import { GermanAdverbSchemas } from "./pos/german-adverb";
import { GermanAuxiliarySchemas } from "./pos/german-auxiliary";
import { GermanCoordinatingConjunctionSchemas } from "./pos/german-coordinating-conjunction";
import { GermanDeterminerSchemas } from "./pos/german-determiner";
import { GermanInterjectionSchemas } from "./pos/german-interjection";
import { GermanNounSchemas } from "./pos/german-noun";
import { GermanNumeralSchemas } from "./pos/german-numeral";
import { GermanOtherSchemas } from "./pos/german-other";
import { GermanParticleSchemas } from "./pos/german-particle";
import { GermanPronounSchemas } from "./pos/german-pronoun";
import { GermanProperNounSchemas } from "./pos/german-proper-noun";
import { GermanPunctuationSchemas } from "./pos/german-punctuation";
import { GermanSubordinatingConjunctionSchemas } from "./pos/german-subordinating-conjunction";
import { GermanSymbolSchemas } from "./pos/german-symbol";
import { GermanVerbSchemas } from "./pos/german-verb";

export const GermanLexemeLemmaSchemas = {
	ADJ: GermanAdjectiveSchemas.LemmaSchema,
	ADP: GermanAdpositionSchemas.LemmaSchema,
	ADV: GermanAdverbSchemas.LemmaSchema,
	AUX: GermanAuxiliarySchemas.LemmaSchema,
	CCONJ: GermanCoordinatingConjunctionSchemas.LemmaSchema,
	DET: GermanDeterminerSchemas.LemmaSchema,
	INTJ: GermanInterjectionSchemas.LemmaSchema,
	NOUN: GermanNounSchemas.LemmaSchema,
	NUM: GermanNumeralSchemas.LemmaSchema,
	PART: GermanParticleSchemas.LemmaSchema,
	PRON: GermanPronounSchemas.LemmaSchema,
	PROPN: GermanProperNounSchemas.LemmaSchema,
	PUNCT: GermanPunctuationSchemas.LemmaSchema,
	SCONJ: GermanSubordinatingConjunctionSchemas.LemmaSchema,
	SYM: GermanSymbolSchemas.LemmaSchema,
	VERB: GermanVerbSchemas.LemmaSchema,
	X: GermanOtherSchemas.LemmaSchema,
} satisfies LemmaSchemaLanguageShape["Lexeme"];

export const GermanStandardInflectionLexemeSelectionSchemas = {
	ADJ: GermanAdjectiveSchemas.InflectionSelectionSchema,
	ADP: GermanAdpositionSchemas.InflectionSelectionSchema,
	ADV: GermanAdverbSchemas.InflectionSelectionSchema,
	AUX: GermanAuxiliarySchemas.InflectionSelectionSchema,
	CCONJ: GermanCoordinatingConjunctionSchemas.InflectionSelectionSchema,
	DET: GermanDeterminerSchemas.InflectionSelectionSchema,
	INTJ: GermanInterjectionSchemas.InflectionSelectionSchema,
	NOUN: GermanNounSchemas.InflectionSelectionSchema,
	NUM: GermanNumeralSchemas.InflectionSelectionSchema,
	PART: GermanParticleSchemas.InflectionSelectionSchema,
	PRON: GermanPronounSchemas.InflectionSelectionSchema,
	PROPN: GermanProperNounSchemas.InflectionSelectionSchema,
	PUNCT: GermanPunctuationSchemas.InflectionSelectionSchema,
	SCONJ: GermanSubordinatingConjunctionSchemas.InflectionSelectionSchema,
	SYM: GermanSymbolSchemas.InflectionSelectionSchema,
	VERB: GermanVerbSchemas.InflectionSelectionSchema,
	X: GermanOtherSchemas.InflectionSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Inflection"]["Lexeme"];

export const GermanStandardLemmaLexemeSelectionSchemas = {
	ADJ: GermanAdjectiveSchemas.LemmaSelectionSchema,
	ADP: GermanAdpositionSchemas.LemmaSelectionSchema,
	ADV: GermanAdverbSchemas.LemmaSelectionSchema,
	AUX: GermanAuxiliarySchemas.LemmaSelectionSchema,
	CCONJ: GermanCoordinatingConjunctionSchemas.LemmaSelectionSchema,
	DET: GermanDeterminerSchemas.LemmaSelectionSchema,
	INTJ: GermanInterjectionSchemas.LemmaSelectionSchema,
	NOUN: GermanNounSchemas.LemmaSelectionSchema,
	NUM: GermanNumeralSchemas.LemmaSelectionSchema,
	PART: GermanParticleSchemas.LemmaSelectionSchema,
	PRON: GermanPronounSchemas.LemmaSelectionSchema,
	PROPN: GermanProperNounSchemas.LemmaSelectionSchema,
	PUNCT: GermanPunctuationSchemas.LemmaSelectionSchema,
	SCONJ: GermanSubordinatingConjunctionSchemas.LemmaSelectionSchema,
	SYM: GermanSymbolSchemas.LemmaSelectionSchema,
	VERB: GermanVerbSchemas.LemmaSelectionSchema,
	X: GermanOtherSchemas.LemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Lemma"]["Lexeme"];

export const GermanStandardVariantLexemeSelectionSchemas = {
	ADJ: GermanAdjectiveSchemas.StandardVariantSelectionSchema,
	ADP: GermanAdpositionSchemas.StandardVariantSelectionSchema,
	ADV: GermanAdverbSchemas.StandardVariantSelectionSchema,
	AUX: GermanAuxiliarySchemas.StandardVariantSelectionSchema,
	CCONJ: GermanCoordinatingConjunctionSchemas.StandardVariantSelectionSchema,
	DET: GermanDeterminerSchemas.StandardVariantSelectionSchema,
	INTJ: GermanInterjectionSchemas.StandardVariantSelectionSchema,
	NOUN: GermanNounSchemas.StandardVariantSelectionSchema,
	NUM: GermanNumeralSchemas.StandardVariantSelectionSchema,
	PART: GermanParticleSchemas.StandardVariantSelectionSchema,
	PRON: GermanPronounSchemas.StandardVariantSelectionSchema,
	PROPN: GermanProperNounSchemas.StandardVariantSelectionSchema,
	PUNCT: GermanPunctuationSchemas.StandardVariantSelectionSchema,
	SCONJ: GermanSubordinatingConjunctionSchemas.StandardVariantSelectionSchema,
	SYM: GermanSymbolSchemas.StandardVariantSelectionSchema,
	VERB: GermanVerbSchemas.StandardVariantSelectionSchema,
	X: GermanOtherSchemas.StandardVariantSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Variant"]["Lexeme"];

export const GermanTypoInflectionLexemeSelectionSchemas = {
	ADJ: GermanAdjectiveSchemas.TypoInflectionSelectionSchema,
	ADP: GermanAdpositionSchemas.TypoInflectionSelectionSchema,
	ADV: GermanAdverbSchemas.TypoInflectionSelectionSchema,
	AUX: GermanAuxiliarySchemas.TypoInflectionSelectionSchema,
	CCONJ: GermanCoordinatingConjunctionSchemas.TypoInflectionSelectionSchema,
	DET: GermanDeterminerSchemas.TypoInflectionSelectionSchema,
	INTJ: GermanInterjectionSchemas.TypoInflectionSelectionSchema,
	NOUN: GermanNounSchemas.TypoInflectionSelectionSchema,
	NUM: GermanNumeralSchemas.TypoInflectionSelectionSchema,
	PART: GermanParticleSchemas.TypoInflectionSelectionSchema,
	PRON: GermanPronounSchemas.TypoInflectionSelectionSchema,
	PROPN: GermanProperNounSchemas.TypoInflectionSelectionSchema,
	PUNCT: GermanPunctuationSchemas.TypoInflectionSelectionSchema,
	SCONJ: GermanSubordinatingConjunctionSchemas.TypoInflectionSelectionSchema,
	SYM: GermanSymbolSchemas.TypoInflectionSelectionSchema,
	VERB: GermanVerbSchemas.TypoInflectionSelectionSchema,
	X: GermanOtherSchemas.TypoInflectionSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Inflection"]["Lexeme"];

export const GermanTypoLemmaLexemeSelectionSchemas = {
	ADJ: GermanAdjectiveSchemas.TypoLemmaSelectionSchema,
	ADP: GermanAdpositionSchemas.TypoLemmaSelectionSchema,
	ADV: GermanAdverbSchemas.TypoLemmaSelectionSchema,
	AUX: GermanAuxiliarySchemas.TypoLemmaSelectionSchema,
	CCONJ: GermanCoordinatingConjunctionSchemas.TypoLemmaSelectionSchema,
	DET: GermanDeterminerSchemas.TypoLemmaSelectionSchema,
	INTJ: GermanInterjectionSchemas.TypoLemmaSelectionSchema,
	NOUN: GermanNounSchemas.TypoLemmaSelectionSchema,
	NUM: GermanNumeralSchemas.TypoLemmaSelectionSchema,
	PART: GermanParticleSchemas.TypoLemmaSelectionSchema,
	PRON: GermanPronounSchemas.TypoLemmaSelectionSchema,
	PROPN: GermanProperNounSchemas.TypoLemmaSelectionSchema,
	PUNCT: GermanPunctuationSchemas.TypoLemmaSelectionSchema,
	SCONJ: GermanSubordinatingConjunctionSchemas.TypoLemmaSelectionSchema,
	SYM: GermanSymbolSchemas.TypoLemmaSelectionSchema,
	VERB: GermanVerbSchemas.TypoLemmaSelectionSchema,
	X: GermanOtherSchemas.TypoLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Lemma"]["Lexeme"];

export const GermanTypoVariantLexemeSelectionSchemas = {
	ADJ: GermanAdjectiveSchemas.TypoVariantSelectionSchema,
	ADP: GermanAdpositionSchemas.TypoVariantSelectionSchema,
	ADV: GermanAdverbSchemas.TypoVariantSelectionSchema,
	AUX: GermanAuxiliarySchemas.TypoVariantSelectionSchema,
	CCONJ: GermanCoordinatingConjunctionSchemas.TypoVariantSelectionSchema,
	DET: GermanDeterminerSchemas.TypoVariantSelectionSchema,
	INTJ: GermanInterjectionSchemas.TypoVariantSelectionSchema,
	NOUN: GermanNounSchemas.TypoVariantSelectionSchema,
	NUM: GermanNumeralSchemas.TypoVariantSelectionSchema,
	PART: GermanParticleSchemas.TypoVariantSelectionSchema,
	PRON: GermanPronounSchemas.TypoVariantSelectionSchema,
	PROPN: GermanProperNounSchemas.TypoVariantSelectionSchema,
	PUNCT: GermanPunctuationSchemas.TypoVariantSelectionSchema,
	SCONJ: GermanSubordinatingConjunctionSchemas.TypoVariantSelectionSchema,
	SYM: GermanSymbolSchemas.TypoVariantSelectionSchema,
	VERB: GermanVerbSchemas.TypoVariantSelectionSchema,
	X: GermanOtherSchemas.TypoVariantSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Variant"]["Lexeme"];
