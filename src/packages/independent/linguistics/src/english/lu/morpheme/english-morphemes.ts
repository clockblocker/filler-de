import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "../../../registry-shapes";
import { buildEnglishMorphemeBundle } from "./shared/build-english-morpheme-bundle";

const EnglishCircumfixBundle = buildEnglishMorphemeBundle({
	morphemeKind: "Circumfix",
});
const EnglishCliticBundle = buildEnglishMorphemeBundle({
	morphemeKind: "Clitic",
});
const EnglishDuplifixBundle = buildEnglishMorphemeBundle({
	morphemeKind: "Duplifix",
});
const EnglishInfixBundle = buildEnglishMorphemeBundle({
	morphemeKind: "Infix",
});
const EnglishInterfixBundle = buildEnglishMorphemeBundle({
	morphemeKind: "Interfix",
});
const EnglishPrefixBundle = buildEnglishMorphemeBundle({
	morphemeKind: "Prefix",
});
const EnglishRootBundle = buildEnglishMorphemeBundle({
	morphemeKind: "Root",
});
const EnglishSuffixBundle = buildEnglishMorphemeBundle({
	morphemeKind: "Suffix",
});
const EnglishSuffixoidBundle = buildEnglishMorphemeBundle({
	morphemeKind: "Suffixoid",
});
const EnglishToneMarkingBundle = buildEnglishMorphemeBundle({
	morphemeKind: "ToneMarking",
});
const EnglishTransfixBundle = buildEnglishMorphemeBundle({
	morphemeKind: "Transfix",
});

export const EnglishMorphemeLemmaSchemas = {
	Circumfix: EnglishCircumfixBundle.LemmaSchema,
	Clitic: EnglishCliticBundle.LemmaSchema,
	Duplifix: EnglishDuplifixBundle.LemmaSchema,
	Infix: EnglishInfixBundle.LemmaSchema,
	Interfix: EnglishInterfixBundle.LemmaSchema,
	Prefix: EnglishPrefixBundle.LemmaSchema,
	Root: EnglishRootBundle.LemmaSchema,
	Suffix: EnglishSuffixBundle.LemmaSchema,
	Suffixoid: EnglishSuffixoidBundle.LemmaSchema,
	ToneMarking: EnglishToneMarkingBundle.LemmaSchema,
	Transfix: EnglishTransfixBundle.LemmaSchema,
} satisfies LemmaSchemaLanguageShape["Morpheme"];

export const EnglishStandardLemmaMorphemeSelectionSchemas = {
	Circumfix: EnglishCircumfixBundle.StandardLemmaSelectionSchema,
	Clitic: EnglishCliticBundle.StandardLemmaSelectionSchema,
	Duplifix: EnglishDuplifixBundle.StandardLemmaSelectionSchema,
	Infix: EnglishInfixBundle.StandardLemmaSelectionSchema,
	Interfix: EnglishInterfixBundle.StandardLemmaSelectionSchema,
	Prefix: EnglishPrefixBundle.StandardLemmaSelectionSchema,
	Root: EnglishRootBundle.StandardLemmaSelectionSchema,
	Suffix: EnglishSuffixBundle.StandardLemmaSelectionSchema,
	Suffixoid: EnglishSuffixoidBundle.StandardLemmaSelectionSchema,
	ToneMarking: EnglishToneMarkingBundle.StandardLemmaSelectionSchema,
	Transfix: EnglishTransfixBundle.StandardLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Lemma"]["Morpheme"];

export const EnglishTypoLemmaMorphemeSelectionSchemas = {
	Circumfix: EnglishCircumfixBundle.TypoLemmaSelectionSchema,
	Clitic: EnglishCliticBundle.TypoLemmaSelectionSchema,
	Duplifix: EnglishDuplifixBundle.TypoLemmaSelectionSchema,
	Infix: EnglishInfixBundle.TypoLemmaSelectionSchema,
	Interfix: EnglishInterfixBundle.TypoLemmaSelectionSchema,
	Prefix: EnglishPrefixBundle.TypoLemmaSelectionSchema,
	Root: EnglishRootBundle.TypoLemmaSelectionSchema,
	Suffix: EnglishSuffixBundle.TypoLemmaSelectionSchema,
	Suffixoid: EnglishSuffixoidBundle.TypoLemmaSelectionSchema,
	ToneMarking: EnglishToneMarkingBundle.TypoLemmaSelectionSchema,
	Transfix: EnglishTransfixBundle.TypoLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Lemma"]["Morpheme"];
