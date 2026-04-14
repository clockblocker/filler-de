import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "../../../registry-shapes";
import {
	EnglishAdjectiveInflectionSelectionSchema,
	EnglishAdjectiveLemmaSchema,
	EnglishAdjectiveLemmaSelectionSchema,
	EnglishAdjectiveStandardVariantSelectionSchema,
	EnglishAdjectiveTypoInflectionSelectionSchema,
	EnglishAdjectiveTypoLemmaSelectionSchema,
	EnglishAdjectiveTypoVariantSelectionSchema,
} from "./adjective/english-adjective-bundle";
import {
	EnglishAdpositionInflectionSelectionSchema,
	EnglishAdpositionLemmaSchema,
	EnglishAdpositionLemmaSelectionSchema,
	EnglishAdpositionStandardVariantSelectionSchema,
	EnglishAdpositionTypoInflectionSelectionSchema,
	EnglishAdpositionTypoLemmaSelectionSchema,
	EnglishAdpositionTypoVariantSelectionSchema,
} from "./adposition/english-adposition-bundle";
import {
	EnglishAdverbInflectionSelectionSchema,
	EnglishAdverbLemmaSchema,
	EnglishAdverbLemmaSelectionSchema,
	EnglishAdverbStandardVariantSelectionSchema,
	EnglishAdverbTypoInflectionSelectionSchema,
	EnglishAdverbTypoLemmaSelectionSchema,
	EnglishAdverbTypoVariantSelectionSchema,
} from "./adverb/english-adverb-bundle";
import {
	EnglishAuxiliaryInflectionSelectionSchema,
	EnglishAuxiliaryLemmaSchema,
	EnglishAuxiliaryLemmaSelectionSchema,
	EnglishAuxiliaryStandardVariantSelectionSchema,
	EnglishAuxiliaryTypoInflectionSelectionSchema,
	EnglishAuxiliaryTypoLemmaSelectionSchema,
	EnglishAuxiliaryTypoVariantSelectionSchema,
} from "./auxiliary/english-auxiliary-bundle";
import {
	EnglishCoordinatingConjunctionInflectionSelectionSchema,
	EnglishCoordinatingConjunctionLemmaSchema,
	EnglishCoordinatingConjunctionLemmaSelectionSchema,
	EnglishCoordinatingConjunctionStandardVariantSelectionSchema,
	EnglishCoordinatingConjunctionTypoInflectionSelectionSchema,
	EnglishCoordinatingConjunctionTypoLemmaSelectionSchema,
	EnglishCoordinatingConjunctionTypoVariantSelectionSchema,
} from "./coordinating-conjunction/english-coordinating-conjunction-bundle";
import {
	EnglishDeterminerInflectionSelectionSchema,
	EnglishDeterminerLemmaSchema,
	EnglishDeterminerLemmaSelectionSchema,
	EnglishDeterminerStandardVariantSelectionSchema,
	EnglishDeterminerTypoInflectionSelectionSchema,
	EnglishDeterminerTypoLemmaSelectionSchema,
	EnglishDeterminerTypoVariantSelectionSchema,
} from "./determiner/english-determiner-bundle";
import {
	EnglishInterjectionInflectionSelectionSchema,
	EnglishInterjectionLemmaSchema,
	EnglishInterjectionLemmaSelectionSchema,
	EnglishInterjectionStandardVariantSelectionSchema,
	EnglishInterjectionTypoInflectionSelectionSchema,
	EnglishInterjectionTypoLemmaSelectionSchema,
	EnglishInterjectionTypoVariantSelectionSchema,
} from "./interjection/english-interjection-bundle";
import {
	EnglishNounInflectionSelectionSchema,
	EnglishNounLemmaSchema,
	EnglishNounLemmaSelectionSchema,
	EnglishNounStandardVariantSelectionSchema,
	EnglishNounTypoInflectionSelectionSchema,
	EnglishNounTypoLemmaSelectionSchema,
	EnglishNounTypoVariantSelectionSchema,
} from "./noun/english-noun-bundle";
import {
	EnglishNumeralInflectionSelectionSchema,
	EnglishNumeralLemmaSchema,
	EnglishNumeralLemmaSelectionSchema,
	EnglishNumeralStandardVariantSelectionSchema,
	EnglishNumeralTypoInflectionSelectionSchema,
	EnglishNumeralTypoLemmaSelectionSchema,
	EnglishNumeralTypoVariantSelectionSchema,
} from "./numeral/english-numeral-bundle";
import {
	EnglishOtherInflectionSelectionSchema,
	EnglishOtherLemmaSchema,
	EnglishOtherLemmaSelectionSchema,
	EnglishOtherStandardVariantSelectionSchema,
	EnglishOtherTypoInflectionSelectionSchema,
	EnglishOtherTypoLemmaSelectionSchema,
	EnglishOtherTypoVariantSelectionSchema,
} from "./other/english-other-bundle";
import {
	EnglishParticleInflectionSelectionSchema,
	EnglishParticleLemmaSchema,
	EnglishParticleLemmaSelectionSchema,
	EnglishParticleStandardVariantSelectionSchema,
	EnglishParticleTypoInflectionSelectionSchema,
	EnglishParticleTypoLemmaSelectionSchema,
	EnglishParticleTypoVariantSelectionSchema,
} from "./particle/english-particle-bundle";
import {
	EnglishPronounInflectionSelectionSchema,
	EnglishPronounLemmaSchema,
	EnglishPronounLemmaSelectionSchema,
	EnglishPronounStandardVariantSelectionSchema,
	EnglishPronounTypoInflectionSelectionSchema,
	EnglishPronounTypoLemmaSelectionSchema,
	EnglishPronounTypoVariantSelectionSchema,
} from "./pronoun/english-pronoun-bundle";
import {
	EnglishProperNounInflectionSelectionSchema,
	EnglishProperNounLemmaSchema,
	EnglishProperNounLemmaSelectionSchema,
	EnglishProperNounStandardVariantSelectionSchema,
	EnglishProperNounTypoInflectionSelectionSchema,
	EnglishProperNounTypoLemmaSelectionSchema,
	EnglishProperNounTypoVariantSelectionSchema,
} from "./proper-noun/english-proper-noun-bundle";
import {
	EnglishPunctuationInflectionSelectionSchema,
	EnglishPunctuationLemmaSchema,
	EnglishPunctuationLemmaSelectionSchema,
	EnglishPunctuationStandardVariantSelectionSchema,
	EnglishPunctuationTypoInflectionSelectionSchema,
	EnglishPunctuationTypoLemmaSelectionSchema,
	EnglishPunctuationTypoVariantSelectionSchema,
} from "./punctuation/english-punctuation-bundle";
import {
	EnglishSubordinatingConjunctionInflectionSelectionSchema,
	EnglishSubordinatingConjunctionLemmaSchema,
	EnglishSubordinatingConjunctionLemmaSelectionSchema,
	EnglishSubordinatingConjunctionStandardVariantSelectionSchema,
	EnglishSubordinatingConjunctionTypoInflectionSelectionSchema,
	EnglishSubordinatingConjunctionTypoLemmaSelectionSchema,
	EnglishSubordinatingConjunctionTypoVariantSelectionSchema,
} from "./subordinating-conjunction/english-subordinating-conjunction-bundle";
import {
	EnglishSymbolInflectionSelectionSchema,
	EnglishSymbolLemmaSchema,
	EnglishSymbolLemmaSelectionSchema,
	EnglishSymbolStandardVariantSelectionSchema,
	EnglishSymbolTypoInflectionSelectionSchema,
	EnglishSymbolTypoLemmaSelectionSchema,
	EnglishSymbolTypoVariantSelectionSchema,
} from "./symbol/english-symbol-bundle";
import {
	EnglishVerbInflectionSelectionSchema,
	EnglishVerbLemmaSchema,
	EnglishVerbLemmaSelectionSchema,
	EnglishVerbStandardVariantSelectionSchema,
	EnglishVerbTypoInflectionSelectionSchema,
	EnglishVerbTypoLemmaSelectionSchema,
	EnglishVerbTypoVariantSelectionSchema,
} from "./verb/english-verb-bundle";

export const EnglishLexemeLemmaSchemas = {
	ADJ: EnglishAdjectiveLemmaSchema,
	ADP: EnglishAdpositionLemmaSchema,
	ADV: EnglishAdverbLemmaSchema,
	AUX: EnglishAuxiliaryLemmaSchema,
	CCONJ: EnglishCoordinatingConjunctionLemmaSchema,
	DET: EnglishDeterminerLemmaSchema,
	INTJ: EnglishInterjectionLemmaSchema,
	NOUN: EnglishNounLemmaSchema,
	NUM: EnglishNumeralLemmaSchema,
	PART: EnglishParticleLemmaSchema,
	PRON: EnglishPronounLemmaSchema,
	PROPN: EnglishProperNounLemmaSchema,
	PUNCT: EnglishPunctuationLemmaSchema,
	SCONJ: EnglishSubordinatingConjunctionLemmaSchema,
	SYM: EnglishSymbolLemmaSchema,
	VERB: EnglishVerbLemmaSchema,
	X: EnglishOtherLemmaSchema,
} satisfies LemmaSchemaLanguageShape["Lexeme"];

export const EnglishStandardInflectionLexemeSelectionSchemas = {
	ADJ: EnglishAdjectiveInflectionSelectionSchema,
	ADP: EnglishAdpositionInflectionSelectionSchema,
	ADV: EnglishAdverbInflectionSelectionSchema,
	AUX: EnglishAuxiliaryInflectionSelectionSchema,
	CCONJ: EnglishCoordinatingConjunctionInflectionSelectionSchema,
	DET: EnglishDeterminerInflectionSelectionSchema,
	INTJ: EnglishInterjectionInflectionSelectionSchema,
	NOUN: EnglishNounInflectionSelectionSchema,
	NUM: EnglishNumeralInflectionSelectionSchema,
	PART: EnglishParticleInflectionSelectionSchema,
	PRON: EnglishPronounInflectionSelectionSchema,
	PROPN: EnglishProperNounInflectionSelectionSchema,
	PUNCT: EnglishPunctuationInflectionSelectionSchema,
	SCONJ: EnglishSubordinatingConjunctionInflectionSelectionSchema,
	SYM: EnglishSymbolInflectionSelectionSchema,
	VERB: EnglishVerbInflectionSelectionSchema,
	X: EnglishOtherInflectionSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Inflection"]["Lexeme"];

export const EnglishStandardLemmaLexemeSelectionSchemas = {
	ADJ: EnglishAdjectiveLemmaSelectionSchema,
	ADP: EnglishAdpositionLemmaSelectionSchema,
	ADV: EnglishAdverbLemmaSelectionSchema,
	AUX: EnglishAuxiliaryLemmaSelectionSchema,
	CCONJ: EnglishCoordinatingConjunctionLemmaSelectionSchema,
	DET: EnglishDeterminerLemmaSelectionSchema,
	INTJ: EnglishInterjectionLemmaSelectionSchema,
	NOUN: EnglishNounLemmaSelectionSchema,
	NUM: EnglishNumeralLemmaSelectionSchema,
	PART: EnglishParticleLemmaSelectionSchema,
	PRON: EnglishPronounLemmaSelectionSchema,
	PROPN: EnglishProperNounLemmaSelectionSchema,
	PUNCT: EnglishPunctuationLemmaSelectionSchema,
	SCONJ: EnglishSubordinatingConjunctionLemmaSelectionSchema,
	SYM: EnglishSymbolLemmaSelectionSchema,
	VERB: EnglishVerbLemmaSelectionSchema,
	X: EnglishOtherLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Lemma"]["Lexeme"];


export const EnglishStandardVariantLexemeSelectionSchemas = {
	ADJ: EnglishAdjectiveStandardVariantSelectionSchema,
	ADP: EnglishAdpositionStandardVariantSelectionSchema,
	ADV: EnglishAdverbStandardVariantSelectionSchema,
	AUX: EnglishAuxiliaryStandardVariantSelectionSchema,
	CCONJ: EnglishCoordinatingConjunctionStandardVariantSelectionSchema,
	DET: EnglishDeterminerStandardVariantSelectionSchema,
	INTJ: EnglishInterjectionStandardVariantSelectionSchema,
	NOUN: EnglishNounStandardVariantSelectionSchema,
	NUM: EnglishNumeralStandardVariantSelectionSchema,
	PART: EnglishParticleStandardVariantSelectionSchema,
	PRON: EnglishPronounStandardVariantSelectionSchema,
	PROPN: EnglishProperNounStandardVariantSelectionSchema,
	PUNCT: EnglishPunctuationStandardVariantSelectionSchema,
	SCONJ: EnglishSubordinatingConjunctionStandardVariantSelectionSchema,
	SYM: EnglishSymbolStandardVariantSelectionSchema,
	VERB: EnglishVerbStandardVariantSelectionSchema,
	X: EnglishOtherStandardVariantSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Variant"]["Lexeme"];

export const EnglishTypoInflectionLexemeSelectionSchemas = {
	ADJ: EnglishAdjectiveTypoInflectionSelectionSchema,
	ADP: EnglishAdpositionTypoInflectionSelectionSchema,
	ADV: EnglishAdverbTypoInflectionSelectionSchema,
	AUX: EnglishAuxiliaryTypoInflectionSelectionSchema,
	CCONJ: EnglishCoordinatingConjunctionTypoInflectionSelectionSchema,
	DET: EnglishDeterminerTypoInflectionSelectionSchema,
	INTJ: EnglishInterjectionTypoInflectionSelectionSchema,
	NOUN: EnglishNounTypoInflectionSelectionSchema,
	NUM: EnglishNumeralTypoInflectionSelectionSchema,
	PART: EnglishParticleTypoInflectionSelectionSchema,
	PRON: EnglishPronounTypoInflectionSelectionSchema,
	PROPN: EnglishProperNounTypoInflectionSelectionSchema,
	PUNCT: EnglishPunctuationTypoInflectionSelectionSchema,
	SCONJ: EnglishSubordinatingConjunctionTypoInflectionSelectionSchema,
	SYM: EnglishSymbolTypoInflectionSelectionSchema,
	VERB: EnglishVerbTypoInflectionSelectionSchema,
	X: EnglishOtherTypoInflectionSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Inflection"]["Lexeme"];

export const EnglishTypoLemmaLexemeSelectionSchemas = {
	ADJ: EnglishAdjectiveTypoLemmaSelectionSchema,
	ADP: EnglishAdpositionTypoLemmaSelectionSchema,
	ADV: EnglishAdverbTypoLemmaSelectionSchema,
	AUX: EnglishAuxiliaryTypoLemmaSelectionSchema,
	CCONJ: EnglishCoordinatingConjunctionTypoLemmaSelectionSchema,
	DET: EnglishDeterminerTypoLemmaSelectionSchema,
	INTJ: EnglishInterjectionTypoLemmaSelectionSchema,
	NOUN: EnglishNounTypoLemmaSelectionSchema,
	NUM: EnglishNumeralTypoLemmaSelectionSchema,
	PART: EnglishParticleTypoLemmaSelectionSchema,
	PRON: EnglishPronounTypoLemmaSelectionSchema,
	PROPN: EnglishProperNounTypoLemmaSelectionSchema,
	PUNCT: EnglishPunctuationTypoLemmaSelectionSchema,
	SCONJ: EnglishSubordinatingConjunctionTypoLemmaSelectionSchema,
	SYM: EnglishSymbolTypoLemmaSelectionSchema,
	VERB: EnglishVerbTypoLemmaSelectionSchema,
	X: EnglishOtherTypoLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Lemma"]["Lexeme"];


export const EnglishTypoVariantLexemeSelectionSchemas = {
	ADJ: EnglishAdjectiveTypoVariantSelectionSchema,
	ADP: EnglishAdpositionTypoVariantSelectionSchema,
	ADV: EnglishAdverbTypoVariantSelectionSchema,
	AUX: EnglishAuxiliaryTypoVariantSelectionSchema,
	CCONJ: EnglishCoordinatingConjunctionTypoVariantSelectionSchema,
	DET: EnglishDeterminerTypoVariantSelectionSchema,
	INTJ: EnglishInterjectionTypoVariantSelectionSchema,
	NOUN: EnglishNounTypoVariantSelectionSchema,
	NUM: EnglishNumeralTypoVariantSelectionSchema,
	PART: EnglishParticleTypoVariantSelectionSchema,
	PRON: EnglishPronounTypoVariantSelectionSchema,
	PROPN: EnglishProperNounTypoVariantSelectionSchema,
	PUNCT: EnglishPunctuationTypoVariantSelectionSchema,
	SCONJ: EnglishSubordinatingConjunctionTypoVariantSelectionSchema,
	SYM: EnglishSymbolTypoVariantSelectionSchema,
	VERB: EnglishVerbTypoVariantSelectionSchema,
	X: EnglishOtherTypoVariantSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Variant"]["Lexeme"];
