import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "../../../../registry-shapes";
import { buildEnglishPhrasemeBundle } from "./shared/build-english-phraseme-bundle";

const EnglishAphorismBundle = buildEnglishPhrasemeBundle({
	phrasemeKind: "Aphorism",
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
	DiscourseFormula: EnglishDiscourseFormulaBundle.LemmaSchema,
	Idiom: EnglishIdiomBundle.LemmaSchema,
	Proverb: EnglishProverbBundle.LemmaSchema,
} satisfies LemmaSchemaLanguageShape["Phraseme"];

export const EnglishStandardLemmaPhrasemeSelectionSchemas = {
	Aphorism: EnglishAphorismBundle.StandardLemmaSelectionSchema,
	DiscourseFormula:
		EnglishDiscourseFormulaBundle.StandardLemmaSelectionSchema,
	Idiom: EnglishIdiomBundle.StandardLemmaSelectionSchema,
	Proverb: EnglishProverbBundle.StandardLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Lemma"]["Phraseme"];

export const EnglishTypoLemmaPhrasemeSelectionSchemas = {
	Aphorism: EnglishAphorismBundle.TypoLemmaSelectionSchema,
	DiscourseFormula: EnglishDiscourseFormulaBundle.TypoLemmaSelectionSchema,
	Idiom: EnglishIdiomBundle.TypoLemmaSelectionSchema,
	Proverb: EnglishProverbBundle.TypoLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Lemma"]["Phraseme"];
