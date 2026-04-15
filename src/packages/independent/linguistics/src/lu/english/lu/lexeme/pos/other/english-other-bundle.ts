import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishOtherInflectionalFeaturesSchema,
	EnglishOtherInherentFeaturesSchema,
} from "./parts/english-other-features";
export const EnglishOtherSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishOtherInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishOtherInherentFeaturesSchema,
	pos: "X",
});
