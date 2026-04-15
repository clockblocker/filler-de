import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishAuxiliaryInflectionalFeaturesSchema,
	EnglishAuxiliaryInherentFeaturesSchema,
} from "./parts/english-auxiliary-features";

export const EnglishAuxiliarySchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAuxiliaryInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAuxiliaryInherentFeaturesSchema,
	pos: "AUX",
});
