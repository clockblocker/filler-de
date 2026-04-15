import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";

const HebrewPunctuationInflectionalFeaturesSchema = featureSchema({});
const HebrewPunctuationInherentFeaturesSchema = featureSchema({});

export const HebrewPunctuationSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema: HebrewPunctuationInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewPunctuationInherentFeaturesSchema,
	pos: "PUNCT",
});
