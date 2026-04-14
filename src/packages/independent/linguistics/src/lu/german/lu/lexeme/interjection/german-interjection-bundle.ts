import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanInterjectionInflectionalFeaturesSchema,
	GermanInterjectionInherentFeaturesSchema,
} from "./parts/german-interjection-features";
import {
	GermanInterjectionLexicalRelationsSchema,
	GermanInterjectionMorphologicalRelationsSchema,
} from "./parts/german-interjection-relations";

const GermanInterjectionSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanInterjectionInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanInterjectionInherentFeaturesSchema,
	lexicalRelationsSchema: GermanInterjectionLexicalRelationsSchema,
	morphologicalRelationsSchema:
		GermanInterjectionMorphologicalRelationsSchema,
	pos: "INTJ",
});

export const GermanInterjectionInflectionSelectionSchema =
	GermanInterjectionSchemas.InflectionSelectionSchema;
export const GermanInterjectionLemmaSelectionSchema =
	GermanInterjectionSchemas.LemmaSelectionSchema;
export const GermanInterjectionStandardVariantSelectionSchema =
	GermanInterjectionSchemas.StandardVariantSelectionSchema;
export const GermanInterjectionTypoInflectionSelectionSchema =
	GermanInterjectionSchemas.TypoInflectionSelectionSchema;
export const GermanInterjectionTypoLemmaSelectionSchema =
	GermanInterjectionSchemas.TypoLemmaSelectionSchema;
export const GermanInterjectionTypoVariantSelectionSchema =
	GermanInterjectionSchemas.TypoVariantSelectionSchema;
export const GermanInterjectionLemmaSchema =
	GermanInterjectionSchemas.LemmaSchema;
