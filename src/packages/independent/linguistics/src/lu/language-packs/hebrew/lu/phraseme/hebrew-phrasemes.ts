import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "../../../../registry-shapes";
import { buildHebrewPhrasemeBundle } from "./shared/build-hebrew-phraseme-bundle";

const HebrewAphorismBundle = buildHebrewPhrasemeBundle({
	phrasemeKind: "Aphorism",
});
const HebrewDiscourseFormulaBundle = buildHebrewPhrasemeBundle({
	phrasemeKind: "DiscourseFormula",
});
const HebrewIdiomBundle = buildHebrewPhrasemeBundle({
	phrasemeKind: "Idiom",
});
const HebrewProverbBundle = buildHebrewPhrasemeBundle({
	phrasemeKind: "Proverb",
});

export const HebrewPhrasemeLemmaSchemas = {
	Aphorism: HebrewAphorismBundle.LemmaSchema,
	DiscourseFormula: HebrewDiscourseFormulaBundle.LemmaSchema,
	Idiom: HebrewIdiomBundle.LemmaSchema,
	Proverb: HebrewProverbBundle.LemmaSchema,
} satisfies LemmaSchemaLanguageShape["Phraseme"];

export const HebrewStandardLemmaPhrasemeSelectionSchemas = {
	Aphorism: HebrewAphorismBundle.StandardLemmaSelectionSchema,
	DiscourseFormula: HebrewDiscourseFormulaBundle.StandardLemmaSelectionSchema,
	Idiom: HebrewIdiomBundle.StandardLemmaSelectionSchema,
	Proverb: HebrewProverbBundle.StandardLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Lemma"]["Phraseme"];

export const HebrewTypoLemmaPhrasemeSelectionSchemas = {
	Aphorism: HebrewAphorismBundle.TypoLemmaSelectionSchema,
	DiscourseFormula: HebrewDiscourseFormulaBundle.TypoLemmaSelectionSchema,
	Idiom: HebrewIdiomBundle.TypoLemmaSelectionSchema,
	Proverb: HebrewProverbBundle.TypoLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Lemma"]["Phraseme"];
