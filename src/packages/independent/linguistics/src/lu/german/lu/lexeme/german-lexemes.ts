import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "../../../registry-shapes";
import {
	GermanAdjectiveInflectionSelectionSchema,
	GermanAdjectiveLemmaSchema,
	GermanAdjectiveLemmaSelectionSchema,
	GermanAdjectiveStandardVariantSelectionSchema,
	GermanAdjectiveTypoInflectionSelectionSchema,
	GermanAdjectiveTypoLemmaSelectionSchema,
	GermanAdjectiveTypoVariantSelectionSchema,
} from "./adjective/german-adjective-bundle";
import {
	GermanAdpositionInflectionSelectionSchema,
	GermanAdpositionLemmaSchema,
	GermanAdpositionLemmaSelectionSchema,
	GermanAdpositionStandardVariantSelectionSchema,
	GermanAdpositionTypoInflectionSelectionSchema,
	GermanAdpositionTypoLemmaSelectionSchema,
	GermanAdpositionTypoVariantSelectionSchema,
} from "./adposition/german-adposition-bundle";
import {
	GermanAdverbInflectionSelectionSchema,
	GermanAdverbLemmaSchema,
	GermanAdverbLemmaSelectionSchema,
	GermanAdverbStandardVariantSelectionSchema,
	GermanAdverbTypoInflectionSelectionSchema,
	GermanAdverbTypoLemmaSelectionSchema,
	GermanAdverbTypoVariantSelectionSchema,
} from "./adverb/german-adverb-bundle";
import {
	GermanAuxiliaryInflectionSelectionSchema,
	GermanAuxiliaryLemmaSchema,
	GermanAuxiliaryLemmaSelectionSchema,
	GermanAuxiliaryStandardVariantSelectionSchema,
	GermanAuxiliaryTypoInflectionSelectionSchema,
	GermanAuxiliaryTypoLemmaSelectionSchema,
	GermanAuxiliaryTypoVariantSelectionSchema,
} from "./auxiliary/german-auxiliary-bundle";
import {
	GermanCoordinatingConjunctionInflectionSelectionSchema,
	GermanCoordinatingConjunctionLemmaSchema,
	GermanCoordinatingConjunctionLemmaSelectionSchema,
	GermanCoordinatingConjunctionStandardVariantSelectionSchema,
	GermanCoordinatingConjunctionTypoInflectionSelectionSchema,
	GermanCoordinatingConjunctionTypoLemmaSelectionSchema,
	GermanCoordinatingConjunctionTypoVariantSelectionSchema,
} from "./coordinating-conjunction/german-coordinating-conjunction-bundle";
import {
	GermanDeterminerInflectionSelectionSchema,
	GermanDeterminerLemmaSchema,
	GermanDeterminerLemmaSelectionSchema,
	GermanDeterminerStandardVariantSelectionSchema,
	GermanDeterminerTypoInflectionSelectionSchema,
	GermanDeterminerTypoLemmaSelectionSchema,
	GermanDeterminerTypoVariantSelectionSchema,
} from "./determiner/german-determiner-bundle";
import {
	GermanInterjectionInflectionSelectionSchema,
	GermanInterjectionLemmaSchema,
	GermanInterjectionLemmaSelectionSchema,
	GermanInterjectionStandardVariantSelectionSchema,
	GermanInterjectionTypoInflectionSelectionSchema,
	GermanInterjectionTypoLemmaSelectionSchema,
	GermanInterjectionTypoVariantSelectionSchema,
} from "./interjection/german-interjection-bundle";
import {
	GermanNounInflectionSelectionSchema,
	GermanNounLemmaSchema,
	GermanNounLemmaSelectionSchema,
	GermanNounStandardVariantSelectionSchema,
	GermanNounTypoInflectionSelectionSchema,
	GermanNounTypoLemmaSelectionSchema,
	GermanNounTypoVariantSelectionSchema,
} from "./noun/german-noun-bundle";
import {
	GermanNumeralInflectionSelectionSchema,
	GermanNumeralLemmaSchema,
	GermanNumeralLemmaSelectionSchema,
	GermanNumeralStandardVariantSelectionSchema,
	GermanNumeralTypoInflectionSelectionSchema,
	GermanNumeralTypoLemmaSelectionSchema,
	GermanNumeralTypoVariantSelectionSchema,
} from "./numeral/german-numeral-bundle";
import {
	GermanOtherInflectionSelectionSchema,
	GermanOtherLemmaSchema,
	GermanOtherLemmaSelectionSchema,
	GermanOtherStandardVariantSelectionSchema,
	GermanOtherTypoInflectionSelectionSchema,
	GermanOtherTypoLemmaSelectionSchema,
	GermanOtherTypoVariantSelectionSchema,
} from "./other/german-other-bundle";
import {
	GermanParticleInflectionSelectionSchema,
	GermanParticleLemmaSchema,
	GermanParticleLemmaSelectionSchema,
	GermanParticleStandardVariantSelectionSchema,
	GermanParticleTypoInflectionSelectionSchema,
	GermanParticleTypoLemmaSelectionSchema,
	GermanParticleTypoVariantSelectionSchema,
} from "./particle/german-particle-bundle";
import {
	GermanPronounInflectionSelectionSchema,
	GermanPronounLemmaSchema,
	GermanPronounLemmaSelectionSchema,
	GermanPronounStandardVariantSelectionSchema,
	GermanPronounTypoInflectionSelectionSchema,
	GermanPronounTypoLemmaSelectionSchema,
	GermanPronounTypoVariantSelectionSchema,
} from "./pronoun/german-pronoun-bundle";
import {
	GermanProperNounInflectionSelectionSchema,
	GermanProperNounLemmaSchema,
	GermanProperNounLemmaSelectionSchema,
	GermanProperNounStandardVariantSelectionSchema,
	GermanProperNounTypoInflectionSelectionSchema,
	GermanProperNounTypoLemmaSelectionSchema,
	GermanProperNounTypoVariantSelectionSchema,
} from "./proper-noun/german-proper-noun-bundle";
import {
	GermanPunctuationInflectionSelectionSchema,
	GermanPunctuationLemmaSchema,
	GermanPunctuationLemmaSelectionSchema,
	GermanPunctuationStandardVariantSelectionSchema,
	GermanPunctuationTypoInflectionSelectionSchema,
	GermanPunctuationTypoLemmaSelectionSchema,
	GermanPunctuationTypoVariantSelectionSchema,
} from "./punctuation/german-punctuation-bundle";
import {
	GermanSubordinatingConjunctionInflectionSelectionSchema,
	GermanSubordinatingConjunctionLemmaSchema,
	GermanSubordinatingConjunctionLemmaSelectionSchema,
	GermanSubordinatingConjunctionStandardVariantSelectionSchema,
	GermanSubordinatingConjunctionTypoInflectionSelectionSchema,
	GermanSubordinatingConjunctionTypoLemmaSelectionSchema,
	GermanSubordinatingConjunctionTypoVariantSelectionSchema,
} from "./subordinating-conjunction/german-subordinating-conjunction-bundle";
import {
	GermanSymbolInflectionSelectionSchema,
	GermanSymbolLemmaSchema,
	GermanSymbolLemmaSelectionSchema,
	GermanSymbolStandardVariantSelectionSchema,
	GermanSymbolTypoInflectionSelectionSchema,
	GermanSymbolTypoLemmaSelectionSchema,
	GermanSymbolTypoVariantSelectionSchema,
} from "./symbol/german-symbol-bundle";
import {
	GermanVerbInflectionSelectionSchema,
	GermanVerbLemmaSchema,
	GermanVerbLemmaSelectionSchema,
	GermanVerbStandardVariantSelectionSchema,
	GermanVerbTypoInflectionSelectionSchema,
	GermanVerbTypoLemmaSelectionSchema,
	GermanVerbTypoVariantSelectionSchema,
} from "./verb/german-verb-bundle";

export const GermanLexemeLemmaSchemas = {
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

export const GermanStandardInflectionLexemeSelectionSchemas = {
	ADJ: GermanAdjectiveInflectionSelectionSchema,
	ADP: GermanAdpositionInflectionSelectionSchema,
	ADV: GermanAdverbInflectionSelectionSchema,
	AUX: GermanAuxiliaryInflectionSelectionSchema,
	CCONJ: GermanCoordinatingConjunctionInflectionSelectionSchema,
	DET: GermanDeterminerInflectionSelectionSchema,
	INTJ: GermanInterjectionInflectionSelectionSchema,
	NOUN: GermanNounInflectionSelectionSchema,
	NUM: GermanNumeralInflectionSelectionSchema,
	PART: GermanParticleInflectionSelectionSchema,
	PRON: GermanPronounInflectionSelectionSchema,
	PROPN: GermanProperNounInflectionSelectionSchema,
	PUNCT: GermanPunctuationInflectionSelectionSchema,
	SCONJ: GermanSubordinatingConjunctionInflectionSelectionSchema,
	SYM: GermanSymbolInflectionSelectionSchema,
	VERB: GermanVerbInflectionSelectionSchema,
	X: GermanOtherInflectionSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Inflection"]["Lexeme"];

export const GermanStandardLemmaLexemeSelectionSchemas = {
	ADJ: GermanAdjectiveLemmaSelectionSchema,
	ADP: GermanAdpositionLemmaSelectionSchema,
	ADV: GermanAdverbLemmaSelectionSchema,
	AUX: GermanAuxiliaryLemmaSelectionSchema,
	CCONJ: GermanCoordinatingConjunctionLemmaSelectionSchema,
	DET: GermanDeterminerLemmaSelectionSchema,
	INTJ: GermanInterjectionLemmaSelectionSchema,
	NOUN: GermanNounLemmaSelectionSchema,
	NUM: GermanNumeralLemmaSelectionSchema,
	PART: GermanParticleLemmaSelectionSchema,
	PRON: GermanPronounLemmaSelectionSchema,
	PROPN: GermanProperNounLemmaSelectionSchema,
	PUNCT: GermanPunctuationLemmaSelectionSchema,
	SCONJ: GermanSubordinatingConjunctionLemmaSelectionSchema,
	SYM: GermanSymbolLemmaSelectionSchema,
	VERB: GermanVerbLemmaSelectionSchema,
	X: GermanOtherLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Lemma"]["Lexeme"];


export const GermanStandardVariantLexemeSelectionSchemas = {
	ADJ: GermanAdjectiveStandardVariantSelectionSchema,
	ADP: GermanAdpositionStandardVariantSelectionSchema,
	ADV: GermanAdverbStandardVariantSelectionSchema,
	AUX: GermanAuxiliaryStandardVariantSelectionSchema,
	CCONJ: GermanCoordinatingConjunctionStandardVariantSelectionSchema,
	DET: GermanDeterminerStandardVariantSelectionSchema,
	INTJ: GermanInterjectionStandardVariantSelectionSchema,
	NOUN: GermanNounStandardVariantSelectionSchema,
	NUM: GermanNumeralStandardVariantSelectionSchema,
	PART: GermanParticleStandardVariantSelectionSchema,
	PRON: GermanPronounStandardVariantSelectionSchema,
	PROPN: GermanProperNounStandardVariantSelectionSchema,
	PUNCT: GermanPunctuationStandardVariantSelectionSchema,
	SCONJ: GermanSubordinatingConjunctionStandardVariantSelectionSchema,
	SYM: GermanSymbolStandardVariantSelectionSchema,
	VERB: GermanVerbStandardVariantSelectionSchema,
	X: GermanOtherStandardVariantSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Variant"]["Lexeme"];

export const GermanTypoInflectionLexemeSelectionSchemas = {
	ADJ: GermanAdjectiveTypoInflectionSelectionSchema,
	ADP: GermanAdpositionTypoInflectionSelectionSchema,
	ADV: GermanAdverbTypoInflectionSelectionSchema,
	AUX: GermanAuxiliaryTypoInflectionSelectionSchema,
	CCONJ: GermanCoordinatingConjunctionTypoInflectionSelectionSchema,
	DET: GermanDeterminerTypoInflectionSelectionSchema,
	INTJ: GermanInterjectionTypoInflectionSelectionSchema,
	NOUN: GermanNounTypoInflectionSelectionSchema,
	NUM: GermanNumeralTypoInflectionSelectionSchema,
	PART: GermanParticleTypoInflectionSelectionSchema,
	PRON: GermanPronounTypoInflectionSelectionSchema,
	PROPN: GermanProperNounTypoInflectionSelectionSchema,
	PUNCT: GermanPunctuationTypoInflectionSelectionSchema,
	SCONJ: GermanSubordinatingConjunctionTypoInflectionSelectionSchema,
	SYM: GermanSymbolTypoInflectionSelectionSchema,
	VERB: GermanVerbTypoInflectionSelectionSchema,
	X: GermanOtherTypoInflectionSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Inflection"]["Lexeme"];

export const GermanTypoLemmaLexemeSelectionSchemas = {
	ADJ: GermanAdjectiveTypoLemmaSelectionSchema,
	ADP: GermanAdpositionTypoLemmaSelectionSchema,
	ADV: GermanAdverbTypoLemmaSelectionSchema,
	AUX: GermanAuxiliaryTypoLemmaSelectionSchema,
	CCONJ: GermanCoordinatingConjunctionTypoLemmaSelectionSchema,
	DET: GermanDeterminerTypoLemmaSelectionSchema,
	INTJ: GermanInterjectionTypoLemmaSelectionSchema,
	NOUN: GermanNounTypoLemmaSelectionSchema,
	NUM: GermanNumeralTypoLemmaSelectionSchema,
	PART: GermanParticleTypoLemmaSelectionSchema,
	PRON: GermanPronounTypoLemmaSelectionSchema,
	PROPN: GermanProperNounTypoLemmaSelectionSchema,
	PUNCT: GermanPunctuationTypoLemmaSelectionSchema,
	SCONJ: GermanSubordinatingConjunctionTypoLemmaSelectionSchema,
	SYM: GermanSymbolTypoLemmaSelectionSchema,
	VERB: GermanVerbTypoLemmaSelectionSchema,
	X: GermanOtherTypoLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Lemma"]["Lexeme"];


export const GermanTypoVariantLexemeSelectionSchemas = {
	ADJ: GermanAdjectiveTypoVariantSelectionSchema,
	ADP: GermanAdpositionTypoVariantSelectionSchema,
	ADV: GermanAdverbTypoVariantSelectionSchema,
	AUX: GermanAuxiliaryTypoVariantSelectionSchema,
	CCONJ: GermanCoordinatingConjunctionTypoVariantSelectionSchema,
	DET: GermanDeterminerTypoVariantSelectionSchema,
	INTJ: GermanInterjectionTypoVariantSelectionSchema,
	NOUN: GermanNounTypoVariantSelectionSchema,
	NUM: GermanNumeralTypoVariantSelectionSchema,
	PART: GermanParticleTypoVariantSelectionSchema,
	PRON: GermanPronounTypoVariantSelectionSchema,
	PROPN: GermanProperNounTypoVariantSelectionSchema,
	PUNCT: GermanPunctuationTypoVariantSelectionSchema,
	SCONJ: GermanSubordinatingConjunctionTypoVariantSelectionSchema,
	SYM: GermanSymbolTypoVariantSelectionSchema,
	VERB: GermanVerbTypoVariantSelectionSchema,
	X: GermanOtherTypoVariantSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Variant"]["Lexeme"];
