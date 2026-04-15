import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishProperNounInflectionalFeaturesSchema,
	EnglishProperNounInherentFeaturesSchema,
} from "./parts/english-proper-noun-features";
import {
	EnglishProperNounLexicalRelationsSchema,
	EnglishProperNounMorphologicalRelationsSchema,
} from "./parts/english-proper-noun-relations";

export const EnglishProperNounSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishProperNounInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishProperNounInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishProperNounLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishProperNounMorphologicalRelationsSchema,
	pos: "PROPN",
});
