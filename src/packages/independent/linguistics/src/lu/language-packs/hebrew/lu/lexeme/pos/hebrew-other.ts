import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";

const HebrewOtherInflectionalFeaturesSchema = featureSchema({});
const HebrewOtherInherentFeaturesSchema = featureSchema({});

export const HebrewOtherSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema: HebrewOtherInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewOtherInherentFeaturesSchema,
	pos: "X",
});
