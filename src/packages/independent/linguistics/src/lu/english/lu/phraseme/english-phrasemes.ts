import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "../../../registry-shapes";
import { buildEnglishPhrasemeBundle } from "./shared/build-english-phraseme-bundle";

const EnglishAphorismBundle = buildEnglishPhrasemeBundle({
	phrasemeKind: "Aphorism",
});
const EnglishClicheBundle = buildEnglishPhrasemeBundle({
	phrasemeKind: "Cliché",
});
const EnglishDiscourseFormulaBundle = buildEnglishPhrasemeBundle({
	phrasemeKind: "DiscourseFormula",
});
const EnglishIdiomBundle = buildEnglishPhrasemeBundle({
	phrasemeKind: "Idiom",
});
const EnglishProverbBundle = buildEnglishPhrasemeBundle({
	phrasemeKind: "Proverb",
});

export const EnglishPhrasemeLemmaSchemas = {
	Aphorism: EnglishAphorismBundle.LemmaSchema,
	Cliché: EnglishClicheBundle.LemmaSchema,
	DiscourseFormula: EnglishDiscourseFormulaBundle.LemmaSchema,
	Idiom: EnglishIdiomBundle.LemmaSchema,
	Proverb: EnglishProverbBundle.LemmaSchema,
} satisfies LemmaSchemaLanguageShape["Phraseme"];

export const EnglishStandardLemmaPhrasemeSelectionSchemas = {
	Aphorism: EnglishAphorismBundle.StandardLemmaSelectionSchema,
	Cliché: EnglishClicheBundle.StandardLemmaSelectionSchema,
	DiscourseFormula: EnglishDiscourseFormulaBundle.StandardLemmaSelectionSchema,
	Idiom: EnglishIdiomBundle.StandardLemmaSelectionSchema,
	Proverb: EnglishProverbBundle.StandardLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Lemma"]["Phraseme"];

export const EnglishStandardPartialPhrasemeSelectionSchemas = {
	Aphorism: EnglishAphorismBundle.StandardPartialSelectionSchema,
	Cliché: EnglishClicheBundle.StandardPartialSelectionSchema,
	DiscourseFormula: EnglishDiscourseFormulaBundle.StandardPartialSelectionSchema,
	Idiom: EnglishIdiomBundle.StandardPartialSelectionSchema,
	Proverb: EnglishProverbBundle.StandardPartialSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Partial"]["Phraseme"];

export const EnglishTypoLemmaPhrasemeSelectionSchemas = {
	Aphorism: EnglishAphorismBundle.TypoLemmaSelectionSchema,
	Cliché: EnglishClicheBundle.TypoLemmaSelectionSchema,
	DiscourseFormula: EnglishDiscourseFormulaBundle.TypoLemmaSelectionSchema,
	Idiom: EnglishIdiomBundle.TypoLemmaSelectionSchema,
	Proverb: EnglishProverbBundle.TypoLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Lemma"]["Phraseme"];

export const EnglishTypoPartialPhrasemeSelectionSchemas = {
	Aphorism: EnglishAphorismBundle.TypoPartialSelectionSchema,
	Cliché: EnglishClicheBundle.TypoPartialSelectionSchema,
	DiscourseFormula: EnglishDiscourseFormulaBundle.TypoPartialSelectionSchema,
	Idiom: EnglishIdiomBundle.TypoPartialSelectionSchema,
	Proverb: EnglishProverbBundle.TypoPartialSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Partial"]["Phraseme"];
