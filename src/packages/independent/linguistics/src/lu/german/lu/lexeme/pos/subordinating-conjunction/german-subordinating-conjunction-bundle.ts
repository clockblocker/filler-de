import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanSubordinatingConjunctionInflectionalFeaturesSchema,
	GermanSubordinatingConjunctionInherentFeaturesSchema,
} from "./parts/german-subordinating-conjunction-features";
export const GermanSubordinatingConjunctionSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema:
		GermanSubordinatingConjunctionInflectionalFeaturesSchema,
	inherentFeaturesSchema:
		GermanSubordinatingConjunctionInherentFeaturesSchema,
	pos: "SCONJ",
});
