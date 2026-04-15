import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanInterjectionInflectionalFeaturesSchema,
	GermanInterjectionInherentFeaturesSchema,
} from "./parts/german-interjection-features";

export const GermanInterjectionSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanInterjectionInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanInterjectionInherentFeaturesSchema,
	pos: "INTJ",
});
