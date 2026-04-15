import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishDeterminerInflectionalFeaturesSchema,
	EnglishDeterminerInherentFeaturesSchema,
} from "./parts/english-determiner-features";

export const EnglishDeterminerSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishDeterminerInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishDeterminerInherentFeaturesSchema,
	pos: "DET",
});
