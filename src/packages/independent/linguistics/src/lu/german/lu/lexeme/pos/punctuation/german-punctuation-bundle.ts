import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanPunctuationInflectionalFeaturesSchema,
	GermanPunctuationInherentFeaturesSchema,
} from "./parts/german-punctuation-features";
export const GermanPunctuationSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanPunctuationInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanPunctuationInherentFeaturesSchema,
	pos: "PUNCT",
});
