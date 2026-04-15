import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishSubordinatingConjunctionInflectionalFeaturesSchema,
	EnglishSubordinatingConjunctionInherentFeaturesSchema,
} from "./parts/english-subordinating-conjunction-features";

export const EnglishSubordinatingConjunctionSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema:
		EnglishSubordinatingConjunctionInflectionalFeaturesSchema,
	inherentFeaturesSchema:
		EnglishSubordinatingConjunctionInherentFeaturesSchema,
	pos: "SCONJ",
});
