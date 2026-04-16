import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";

const HebrewInterjectionInflectionalFeaturesSchema = featureSchema({});
const HebrewInterjectionInherentFeaturesSchema = featureSchema({});

export const HebrewInterjectionSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema: HebrewInterjectionInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewInterjectionInherentFeaturesSchema,
	pos: "INTJ",
});
