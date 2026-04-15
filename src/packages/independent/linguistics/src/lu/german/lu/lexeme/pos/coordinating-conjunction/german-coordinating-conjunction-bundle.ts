import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanCoordinatingConjunctionInflectionalFeaturesSchema,
	GermanCoordinatingConjunctionInherentFeaturesSchema,
} from "./parts/german-coordinating-conjunction-features";

export const GermanCoordinatingConjunctionSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema:
		GermanCoordinatingConjunctionInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanCoordinatingConjunctionInherentFeaturesSchema,
	pos: "CCONJ",
});
