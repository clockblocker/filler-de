import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanProperNounInflectionalFeaturesSchema,
	GermanProperNounInherentFeaturesSchema,
} from "./parts/german-proper-noun-features";

export const GermanProperNounSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanProperNounInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanProperNounInherentFeaturesSchema,
	pos: "PROPN",
});
