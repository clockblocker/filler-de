import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";

const HebrewSymbolInflectionalFeaturesSchema = featureSchema({});
const HebrewSymbolInherentFeaturesSchema = featureSchema({});

export const HebrewSymbolSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema: HebrewSymbolInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewSymbolInherentFeaturesSchema,
	pos: "SYM",
});
