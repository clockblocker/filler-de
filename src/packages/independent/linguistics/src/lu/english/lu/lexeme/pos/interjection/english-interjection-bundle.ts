import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishInterjectionInflectionalFeaturesSchema,
	EnglishInterjectionInherentFeaturesSchema,
} from "./parts/english-interjection-features";
export const EnglishInterjectionSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishInterjectionInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishInterjectionInherentFeaturesSchema,
	pos: "INTJ",
});
