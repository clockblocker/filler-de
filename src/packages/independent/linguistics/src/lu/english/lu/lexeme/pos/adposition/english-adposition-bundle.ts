import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishAdpositionInflectionalFeaturesSchema,
	EnglishAdpositionInherentFeaturesSchema,
} from "./parts/english-adposition-features";
import {
	EnglishAdpositionLexicalRelationsSchema,
	EnglishAdpositionMorphologicalRelationsSchema,
} from "./parts/english-adposition-relations";

export const EnglishAdpositionSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAdpositionInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAdpositionInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishAdpositionLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishAdpositionMorphologicalRelationsSchema,
	pos: "ADP",
});
