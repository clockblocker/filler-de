import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishPronounInflectionalFeaturesSchema,
	EnglishPronounInherentFeaturesSchema,
} from "./parts/english-pronoun-features";
import {
	EnglishPronounLexicalRelationsSchema,
	EnglishPronounMorphologicalRelationsSchema,
} from "./parts/english-pronoun-relations";

export const EnglishPronounSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishPronounInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishPronounInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishPronounLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishPronounMorphologicalRelationsSchema,
	pos: "PRON",
});
