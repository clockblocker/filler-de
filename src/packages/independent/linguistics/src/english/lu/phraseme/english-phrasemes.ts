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

export const EnglishPhrasemeLemmaSchemas = {
	Aphorism: EnglishAphorismBundle.LemmaSchema,
	Cliché: EnglishClicheBundle.LemmaSchema,
	DiscourseFormula: EnglishDiscourseFormulaBundle.LemmaSchema,
} satisfies LemmaSchemaLanguageShape["Phraseme"];

export const EnglishStandardLemmaPhrasemeSelectionSchemas = {
	Aphorism: EnglishAphorismBundle.StandardLemmaSelectionSchema,
	Cliché: EnglishClicheBundle.StandardLemmaSelectionSchema,
	DiscourseFormula: EnglishDiscourseFormulaBundle.StandardLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Standard"]["Lemma"]["Phraseme"];

export const EnglishTypoLemmaPhrasemeSelectionSchemas = {
	Aphorism: EnglishAphorismBundle.TypoLemmaSelectionSchema,
	Cliché: EnglishClicheBundle.TypoLemmaSelectionSchema,
	DiscourseFormula: EnglishDiscourseFormulaBundle.TypoLemmaSelectionSchema,
} satisfies SelectionSchemaLanguageShape["Typo"]["Lemma"]["Phraseme"];
