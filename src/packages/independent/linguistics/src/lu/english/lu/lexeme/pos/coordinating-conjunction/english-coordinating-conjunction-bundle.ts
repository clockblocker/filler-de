import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishCoordinatingConjunctionInflectionalFeaturesSchema,
	EnglishCoordinatingConjunctionInherentFeaturesSchema,
} from "./parts/english-coordinating-conjunction-features";

export const EnglishCoordinatingConjunctionSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema:
		EnglishCoordinatingConjunctionInflectionalFeaturesSchema,
	inherentFeaturesSchema:
		EnglishCoordinatingConjunctionInherentFeaturesSchema,
	pos: "CCONJ",
});
