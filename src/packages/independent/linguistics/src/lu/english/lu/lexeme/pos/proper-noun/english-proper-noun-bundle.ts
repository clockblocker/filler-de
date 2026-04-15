import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishProperNounInflectionalFeaturesSchema,
	EnglishProperNounInherentFeaturesSchema,
} from "./parts/english-proper-noun-features";
export const EnglishProperNounSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishProperNounInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishProperNounInherentFeaturesSchema,
	pos: "PROPN",
});
