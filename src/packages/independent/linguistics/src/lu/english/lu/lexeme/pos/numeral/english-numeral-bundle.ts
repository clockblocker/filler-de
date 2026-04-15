import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishNumeralInflectionalFeaturesSchema,
	EnglishNumeralInherentFeaturesSchema,
} from "./parts/english-numeral-features";
export const EnglishNumeralSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishNumeralInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishNumeralInherentFeaturesSchema,
	pos: "NUM",
});
