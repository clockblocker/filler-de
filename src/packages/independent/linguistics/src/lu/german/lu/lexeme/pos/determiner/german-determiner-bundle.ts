import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanDeterminerInflectionalFeaturesSchema,
	GermanDeterminerInherentFeaturesSchema,
} from "./parts/german-determiner-features";
export const GermanDeterminerSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanDeterminerInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanDeterminerInherentFeaturesSchema,
	pos: "DET",
});
