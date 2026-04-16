import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";

const HebrewCoordinatingConjunctionInflectionalFeaturesSchema = featureSchema(
	{},
);
const HebrewCoordinatingConjunctionInherentFeaturesSchema = featureSchema({});

export const HebrewCoordinatingConjunctionSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema:
		HebrewCoordinatingConjunctionInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewCoordinatingConjunctionInherentFeaturesSchema,
	pos: "CCONJ",
});
