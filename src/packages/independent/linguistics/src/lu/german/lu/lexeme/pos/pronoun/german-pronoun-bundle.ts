import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanPronounInflectionalFeaturesSchema,
	GermanPronounInherentFeaturesSchema,
} from "./parts/german-pronoun-features";
export const GermanPronounSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanPronounInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanPronounInherentFeaturesSchema,
	pos: "PRON",
});
