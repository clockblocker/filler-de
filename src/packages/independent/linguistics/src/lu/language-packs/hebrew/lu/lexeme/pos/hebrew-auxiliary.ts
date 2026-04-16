import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";
import { HebrewFeature } from "../shared/hebrew-common-enums";
import { HebrewAuxiliaryInflectionalFeaturesSchema } from "../shared/hebrew-verbal-inflection-features";

const HebrewAuxiliaryInherentFeaturesSchema = featureSchema({
	verbType: HebrewFeature.VerbType,
});

export const HebrewAuxiliarySchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema: HebrewAuxiliaryInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewAuxiliaryInherentFeaturesSchema,
	pos: "AUX",
});
