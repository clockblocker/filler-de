import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishDeterminerInflectionalFeaturesSchema,
	EnglishDeterminerInherentFeaturesSchema,
} from "./parts/english-determiner-features";
import {
	EnglishDeterminerLexicalRelationsSchema,
	EnglishDeterminerMorphologicalRelationsSchema,
} from "./parts/english-determiner-relations";

export const EnglishDeterminerSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishDeterminerInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishDeterminerInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishDeterminerLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishDeterminerMorphologicalRelationsSchema,
	pos: "DET",
});
