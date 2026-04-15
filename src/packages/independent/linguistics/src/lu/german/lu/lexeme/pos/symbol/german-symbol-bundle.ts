import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanSymbolInflectionalFeaturesSchema,
	GermanSymbolInherentFeaturesSchema,
} from "./parts/german-symbol-features";

export const GermanSymbolSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanSymbolInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanSymbolInherentFeaturesSchema,
	pos: "SYM",
});
