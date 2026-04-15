import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishPronounInflectionalFeaturesSchema,
	EnglishPronounInherentFeaturesSchema,
} from "./parts/english-pronoun-features";
export const EnglishPronounSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishPronounInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishPronounInherentFeaturesSchema,
	pos: "PRON",
});
