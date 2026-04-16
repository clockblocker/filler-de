import { UniversalFeature } from "../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";

const GermanPunctuationInflectionalFeaturesSchema = featureSchema({});

const GermanPunctuationInherentFeaturesSchema = featureSchema({
	punctType: UniversalFeature.PunctType,
});

export const GermanPunctuationSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanPunctuationInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanPunctuationInherentFeaturesSchema,
	pos: "PUNCT",
});
