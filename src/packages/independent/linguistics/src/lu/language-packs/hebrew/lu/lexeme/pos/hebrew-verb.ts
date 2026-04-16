import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";
import { HebrewFeature } from "../shared/hebrew-common-enums";
import { HebrewVerbInflectionalFeaturesSchema } from "../shared/hebrew-verbal-inflection-features";

const HebrewVerbInherentFeaturesSchema = featureSchema({
	hebBinyan: HebrewFeature.HebBinyan,
	hebExistential: HebrewFeature.HebExistential,
});

export const HebrewVerbSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema: HebrewVerbInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewVerbInherentFeaturesSchema,
	pos: "VERB",
});
