import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "../../../registry-shapes";
import { buildGermanMorphemeBundle } from "./shared/build-german-morpheme-bundle";

const GermanCircumfixBundle = buildGermanMorphemeBundle({
	morphemeKind: "Circumfix",
});
const GermanCliticBundle = buildGermanMorphemeBundle({
	morphemeKind: "Clitic",
});
const GermanDuplifixBundle = buildGermanMorphemeBundle({
	morphemeKind: "Duplifix",
});
const GermanInfixBundle = buildGermanMorphemeBundle({
	morphemeKind: "Infix",
});
const GermanInterfixBundle = buildGermanMorphemeBundle({
	morphemeKind: "Interfix",
});
const GermanPrefixBundle = buildGermanMorphemeBundle({
	morphemeKind: "Prefix",
});
const GermanRootBundle = buildGermanMorphemeBundle({
	morphemeKind: "Root",
});
const GermanSuffixBundle = buildGermanMorphemeBundle({
	morphemeKind: "Suffix",
});
const GermanSuffixoidBundle = buildGermanMorphemeBundle({
	morphemeKind: "Suffixoid",
});
const GermanToneMarkingBundle = buildGermanMorphemeBundle({
	morphemeKind: "ToneMarking",
});
const GermanTransfixBundle = buildGermanMorphemeBundle({
	morphemeKind: "Transfix",
});

export const GermanMorphemeLemmaSchemas = {
	Circumfix: GermanCircumfixBundle.LemmaSchema,
	Clitic: GermanCliticBundle.LemmaSchema,
	Duplifix: GermanDuplifixBundle.LemmaSchema,
	Infix: GermanInfixBundle.LemmaSchema,
	Interfix: GermanInterfixBundle.LemmaSchema,
	Prefix: GermanPrefixBundle.LemmaSchema,
	Root: GermanRootBundle.LemmaSchema,
	Suffix: GermanSuffixBundle.LemmaSchema,
	Suffixoid: GermanSuffixoidBundle.LemmaSchema,
	ToneMarking: GermanToneMarkingBundle.LemmaSchema,
	Transfix: GermanTransfixBundle.LemmaSchema,
} satisfies LemmaSchemaLanguageShape["Morpheme"];

export const GermanStandardLemmaMorphemeSelectionSchemas = {
	Circumfix: GermanCircumfixBundle.StandardLemmaSelectionSchema,
	Clitic: GermanCliticBundle.StandardLemmaSelectionSchema,
	Duplifix: GermanDuplifixBundle.StandardLemmaSelectionSchema,
	Infix: GermanInfixBundle.StandardLemmaSelectionSchema,
	Interfix: GermanInterfixBundle.StandardLemmaSelectionSchema,
	Prefix: GermanPrefixBundle.StandardLemmaSelectionSchema,
	Root: GermanRootBundle.StandardLemmaSelectionSchema,
	Suffix: GermanSuffixBundle.StandardLemmaSelectionSchema,
	Suffixoid: GermanSuffixoidBundle.StandardLemmaSelectionSchema,
	ToneMarking: GermanToneMarkingBundle.StandardLemmaSelectionSchema,
	Transfix: GermanTransfixBundle.StandardLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Lemma"]["Morpheme"];

export const GermanTypoLemmaMorphemeSelectionSchemas = {
	Circumfix: GermanCircumfixBundle.TypoLemmaSelectionSchema,
	Clitic: GermanCliticBundle.TypoLemmaSelectionSchema,
	Duplifix: GermanDuplifixBundle.TypoLemmaSelectionSchema,
	Infix: GermanInfixBundle.TypoLemmaSelectionSchema,
	Interfix: GermanInterfixBundle.TypoLemmaSelectionSchema,
	Prefix: GermanPrefixBundle.TypoLemmaSelectionSchema,
	Root: GermanRootBundle.TypoLemmaSelectionSchema,
	Suffix: GermanSuffixBundle.TypoLemmaSelectionSchema,
	Suffixoid: GermanSuffixoidBundle.TypoLemmaSelectionSchema,
	ToneMarking: GermanToneMarkingBundle.TypoLemmaSelectionSchema,
	Transfix: GermanTransfixBundle.TypoLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Lemma"]["Morpheme"];
