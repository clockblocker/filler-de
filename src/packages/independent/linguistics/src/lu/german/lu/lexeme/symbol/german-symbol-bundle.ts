import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanSymbolInflectionalFeaturesSchema,
	GermanSymbolInherentFeaturesSchema,
} from "./parts/german-symbol-features";
import {
	GermanSymbolLexicalRelationsSchema,
	GermanSymbolMorphologicalRelationsSchema,
} from "./parts/german-symbol-relations";

export const GermanSymbolSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanSymbolInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanSymbolInherentFeaturesSchema,
	lexicalRelationsSchema: GermanSymbolLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanSymbolMorphologicalRelationsSchema,
	pos: "SYM",
});
