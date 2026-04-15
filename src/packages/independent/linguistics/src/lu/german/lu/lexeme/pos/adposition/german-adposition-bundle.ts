import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanAdpositionInflectionalFeaturesSchema,
	GermanAdpositionInherentFeaturesSchema,
} from "./parts/german-adposition-features";

export const GermanAdpositionSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAdpositionInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAdpositionInherentFeaturesSchema,
	pos: "ADP",
});
