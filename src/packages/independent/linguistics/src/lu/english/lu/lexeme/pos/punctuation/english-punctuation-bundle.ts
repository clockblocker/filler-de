import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishPunctuationInflectionalFeaturesSchema,
	EnglishPunctuationInherentFeaturesSchema,
} from "./parts/english-punctuation-features";

export const EnglishPunctuationSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishPunctuationInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishPunctuationInherentFeaturesSchema,
	pos: "PUNCT",
});
