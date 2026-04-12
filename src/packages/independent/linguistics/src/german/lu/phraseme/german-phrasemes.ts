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

export const GermanPhrasemeLemmaSchemas = {
	Aphorism: GermanAphorismBundle.LemmaSchema,
	Cliché: GermanClicheBundle.LemmaSchema,
	DiscourseFormula: GermanDiscourseFormulaBundle.LemmaSchema,
} satisfies LemmaSchemaLanguageShape["Phraseme"];

export const GermanStandardLemmaPhrasemeSelectionSchemas = {
	Aphorism: GermanAphorismBundle.StandardLemmaSelectionSchema,
	Cliché: GermanClicheBundle.StandardLemmaSelectionSchema,
	DiscourseFormula: GermanDiscourseFormulaBundle.StandardLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Lemma"]["Phraseme"];

export const GermanTypoLemmaPhrasemeSelectionSchemas = {
	Aphorism: GermanAphorismBundle.TypoLemmaSelectionSchema,
	Cliché: GermanClicheBundle.TypoLemmaSelectionSchema,
	DiscourseFormula: GermanDiscourseFormulaBundle.TypoLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Lemma"]["Phraseme"];
