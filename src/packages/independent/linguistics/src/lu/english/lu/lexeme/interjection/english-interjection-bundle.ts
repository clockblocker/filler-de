import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishInterjectionInflectionalFeaturesSchema,
	EnglishInterjectionInherentFeaturesSchema,
} from "./parts/english-interjection-features";
import {
	EnglishInterjectionLexicalRelationsSchema,
	EnglishInterjectionMorphologicalRelationsSchema,
} from "./parts/english-interjection-relations";

export const EnglishInterjectionSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishInterjectionInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishInterjectionInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishInterjectionLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishInterjectionMorphologicalRelationsSchema,
	pos: "INTJ",
});
