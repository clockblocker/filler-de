import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishSymbolInflectionalFeaturesSchema,
	EnglishSymbolInherentFeaturesSchema,
} from "./parts/english-symbol-features";

export const EnglishSymbolSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishSymbolInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishSymbolInherentFeaturesSchema,
	pos: "SYM",
});
