import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishAdjectiveInflectionalFeaturesSchema,
	EnglishAdjectiveInherentFeaturesSchema,
} from "./parts/english-adjective-features";

export const EnglishAdjectiveSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAdjectiveInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAdjectiveInherentFeaturesSchema,
	pos: "ADJ",
});
