import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";

import {
	EnglishAdpositionInflectionalFeaturesSchema,
	EnglishAdpositionInherentFeaturesSchema,
} from "./parts/english-adposition-features";

export const EnglishAdpositionSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAdpositionInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAdpositionInherentFeaturesSchema,
	pos: "ADP",
});
