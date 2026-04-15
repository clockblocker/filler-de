import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishAdverbInflectionalFeaturesSchema,
	EnglishAdverbInherentFeaturesSchema,
} from "./parts/english-adverb-features";
import {
	EnglishAdverbLexicalRelationsSchema,
	EnglishAdverbMorphologicalRelationsSchema,
} from "./parts/english-adverb-relations";

export const EnglishAdverbSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAdverbInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAdverbInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishAdverbLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishAdverbMorphologicalRelationsSchema,
	pos: "ADV",
});
