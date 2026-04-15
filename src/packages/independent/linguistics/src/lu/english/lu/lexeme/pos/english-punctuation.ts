import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";

const EnglishPunctuationInflectionalFeaturesSchema = featureSchema({});

const EnglishPunctuationInherentFeaturesSchema = featureSchema({});

export const EnglishPunctuationSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishPunctuationInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishPunctuationInherentFeaturesSchema,
	pos: "PUNCT",
});
