import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanAuxiliaryInflectionalFeaturesSchema,
	GermanAuxiliaryInherentFeaturesSchema,
} from "./parts/german-auxiliary-features";

export const GermanAuxiliarySchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAuxiliaryInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAuxiliaryInherentFeaturesSchema,
	pos: "AUX",
});
