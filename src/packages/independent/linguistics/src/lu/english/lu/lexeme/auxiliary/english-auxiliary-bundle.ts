import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishAuxiliaryInflectionalFeaturesSchema,
	EnglishAuxiliaryInherentFeaturesSchema,
} from "./parts/english-auxiliary-features";
import {
	EnglishAuxiliaryLexicalRelationsSchema,
	EnglishAuxiliaryMorphologicalRelationsSchema,
} from "./parts/english-auxiliary-relations";

export const EnglishAuxiliarySchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAuxiliaryInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAuxiliaryInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishAuxiliaryLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishAuxiliaryMorphologicalRelationsSchema,
	pos: "AUX",
});
