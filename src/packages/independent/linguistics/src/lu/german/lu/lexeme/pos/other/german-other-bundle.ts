import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanOtherInflectionalFeaturesSchema,
	GermanOtherInherentFeaturesSchema,
} from "./parts/german-other-features";
export const GermanOtherSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanOtherInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanOtherInherentFeaturesSchema,
	pos: "X",
});
