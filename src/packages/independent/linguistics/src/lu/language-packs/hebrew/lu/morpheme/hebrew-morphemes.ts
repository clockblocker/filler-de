import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "../../../../registry-shapes";
import { buildHebrewMorphemeBundle } from "./shared/build-hebrew-morpheme-bundle";

const HebrewCircumfixBundle = buildHebrewMorphemeBundle({
	morphemeKind: "Circumfix",
});
const HebrewCliticBundle = buildHebrewMorphemeBundle({
	morphemeKind: "Clitic",
});
const HebrewDuplifixBundle = buildHebrewMorphemeBundle({
	morphemeKind: "Duplifix",
});
const HebrewInfixBundle = buildHebrewMorphemeBundle({
	morphemeKind: "Infix",
});
const HebrewInterfixBundle = buildHebrewMorphemeBundle({
	morphemeKind: "Interfix",
});
const HebrewPrefixBundle = buildHebrewMorphemeBundle({
	morphemeKind: "Prefix",
});
const HebrewRootBundle = buildHebrewMorphemeBundle({
	morphemeKind: "Root",
});
const HebrewSuffixBundle = buildHebrewMorphemeBundle({
	morphemeKind: "Suffix",
});
const HebrewSuffixoidBundle = buildHebrewMorphemeBundle({
	morphemeKind: "Suffixoid",
});
const HebrewToneMarkingBundle = buildHebrewMorphemeBundle({
	morphemeKind: "ToneMarking",
});
const HebrewTransfixBundle = buildHebrewMorphemeBundle({
	morphemeKind: "Transfix",
});

export const HebrewMorphemeLemmaSchemas = {
	Circumfix: HebrewCircumfixBundle.LemmaSchema,
	Clitic: HebrewCliticBundle.LemmaSchema,
	Duplifix: HebrewDuplifixBundle.LemmaSchema,
	Infix: HebrewInfixBundle.LemmaSchema,
	Interfix: HebrewInterfixBundle.LemmaSchema,
	Prefix: HebrewPrefixBundle.LemmaSchema,
	Root: HebrewRootBundle.LemmaSchema,
	Suffix: HebrewSuffixBundle.LemmaSchema,
	Suffixoid: HebrewSuffixoidBundle.LemmaSchema,
	ToneMarking: HebrewToneMarkingBundle.LemmaSchema,
	Transfix: HebrewTransfixBundle.LemmaSchema,
} satisfies LemmaSchemaLanguageShape["Morpheme"];

export const HebrewStandardLemmaMorphemeSelectionSchemas = {
	Circumfix: HebrewCircumfixBundle.StandardLemmaSelectionSchema,
	Clitic: HebrewCliticBundle.StandardLemmaSelectionSchema,
	Duplifix: HebrewDuplifixBundle.StandardLemmaSelectionSchema,
	Infix: HebrewInfixBundle.StandardLemmaSelectionSchema,
	Interfix: HebrewInterfixBundle.StandardLemmaSelectionSchema,
	Prefix: HebrewPrefixBundle.StandardLemmaSelectionSchema,
	Root: HebrewRootBundle.StandardLemmaSelectionSchema,
	Suffix: HebrewSuffixBundle.StandardLemmaSelectionSchema,
	Suffixoid: HebrewSuffixoidBundle.StandardLemmaSelectionSchema,
	ToneMarking: HebrewToneMarkingBundle.StandardLemmaSelectionSchema,
	Transfix: HebrewTransfixBundle.StandardLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Lemma"]["Morpheme"];

export const HebrewTypoLemmaMorphemeSelectionSchemas = {
	Circumfix: HebrewCircumfixBundle.TypoLemmaSelectionSchema,
	Clitic: HebrewCliticBundle.TypoLemmaSelectionSchema,
	Duplifix: HebrewDuplifixBundle.TypoLemmaSelectionSchema,
	Infix: HebrewInfixBundle.TypoLemmaSelectionSchema,
	Interfix: HebrewInterfixBundle.TypoLemmaSelectionSchema,
	Prefix: HebrewPrefixBundle.TypoLemmaSelectionSchema,
	Root: HebrewRootBundle.TypoLemmaSelectionSchema,
	Suffix: HebrewSuffixBundle.TypoLemmaSelectionSchema,
	Suffixoid: HebrewSuffixoidBundle.TypoLemmaSelectionSchema,
	ToneMarking: HebrewToneMarkingBundle.TypoLemmaSelectionSchema,
	Transfix: HebrewTransfixBundle.TypoLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Lemma"]["Morpheme"];
