import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanNumeralInflectionalFeaturesSchema,
	GermanNumeralInherentFeaturesSchema,
} from "./parts/german-numeral-features";

export const GermanNumeralSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanNumeralInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanNumeralInherentFeaturesSchema,
	pos: "NUM",
});
