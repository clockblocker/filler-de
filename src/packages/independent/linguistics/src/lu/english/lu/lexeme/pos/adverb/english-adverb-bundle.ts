import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishAdverbInflectionalFeaturesSchema,
	EnglishAdverbInherentFeaturesSchema,
} from "./parts/english-adverb-features";
export const EnglishAdverbSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAdverbInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAdverbInherentFeaturesSchema,
	pos: "ADV",
});
