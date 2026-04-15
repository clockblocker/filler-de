import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";
import { HebrewFeature } from "../shared/hebrew-common-enums";

const HebrewAdverbInflectionalFeaturesSchema = featureSchema({});

const HebrewAdverbInherentFeaturesSchema = featureSchema({
	prefix: HebrewFeature.Prefix,
});

export const HebrewAdverbSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema: HebrewAdverbInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewAdverbInherentFeaturesSchema,
	pos: "ADV",
});
