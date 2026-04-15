import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanAdjectiveInflectionalFeaturesSchema,
	GermanAdjectiveInherentFeaturesSchema,
} from "./parts/german-adjective-features";
export const GermanAdjectiveSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAdjectiveInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAdjectiveInherentFeaturesSchema,
	pos: "ADJ",
});
