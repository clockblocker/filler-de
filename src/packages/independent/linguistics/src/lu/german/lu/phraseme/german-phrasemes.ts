import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "../../../registry-shapes";
import { buildGermanPhrasemeBundle } from "./shared/build-german-phraseme-bundle";

const GermanAphorismBundle = buildGermanPhrasemeBundle({
	phrasemeKind: "Aphorism",
});
const GermanClicheBundle = buildGermanPhrasemeBundle({
	phrasemeKind: "Cliché",
});
const GermanDiscourseFormulaBundle = buildGermanPhrasemeBundle({
	phrasemeKind: "DiscourseFormula",
});
const GermanIdiomBundle = buildGermanPhrasemeBundle({
	phrasemeKind: "Idiom",
});
const GermanProverbBundle = buildGermanPhrasemeBundle({
	phrasemeKind: "Proverb",
});

export const GermanPhrasemeLemmaSchemas = {
	Aphorism: GermanAphorismBundle.LemmaSchema,
	Cliché: GermanClicheBundle.LemmaSchema,
	DiscourseFormula: GermanDiscourseFormulaBundle.LemmaSchema,
	Idiom: GermanIdiomBundle.LemmaSchema,
	Proverb: GermanProverbBundle.LemmaSchema,
} satisfies LemmaSchemaLanguageShape["Phraseme"];

export const GermanStandardLemmaPhrasemeSelectionSchemas = {
	Aphorism: GermanAphorismBundle.StandardLemmaSelectionSchema,
	Cliché: GermanClicheBundle.StandardLemmaSelectionSchema,
	DiscourseFormula: GermanDiscourseFormulaBundle.StandardLemmaSelectionSchema,
	Idiom: GermanIdiomBundle.StandardLemmaSelectionSchema,
	Proverb: GermanProverbBundle.StandardLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Lemma"]["Phraseme"];

export const GermanTypoLemmaPhrasemeSelectionSchemas = {
	Aphorism: GermanAphorismBundle.TypoLemmaSelectionSchema,
	Cliché: GermanClicheBundle.TypoLemmaSelectionSchema,
	DiscourseFormula: GermanDiscourseFormulaBundle.TypoLemmaSelectionSchema,
	Idiom: GermanIdiomBundle.TypoLemmaSelectionSchema,
	Proverb: GermanProverbBundle.TypoLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Lemma"]["Phraseme"];
