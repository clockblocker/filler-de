import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishSymbolInflectionalFeaturesSchema,
	EnglishSymbolInherentFeaturesSchema,
} from "./parts/english-symbol-features";
import {
	EnglishSymbolLexicalRelationsSchema,
	EnglishSymbolMorphologicalRelationsSchema,
} from "./parts/english-symbol-relations";

export const EnglishSymbolSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishSymbolInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishSymbolInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishSymbolLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishSymbolMorphologicalRelationsSchema,
	pos: "SYM",
});
