import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanAdverbInflectionalFeaturesSchema,
	GermanAdverbInherentFeaturesSchema,
} from "./parts/german-adverb-features";

export const GermanAdverbSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAdverbInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAdverbInherentFeaturesSchema,
	pos: "ADV",
});
