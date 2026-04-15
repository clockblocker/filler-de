import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishPunctuationInflectionalFeaturesSchema,
	EnglishPunctuationInherentFeaturesSchema,
} from "./parts/english-punctuation-features";
import {
	EnglishPunctuationLexicalRelationsSchema,
	EnglishPunctuationMorphologicalRelationsSchema,
} from "./parts/english-punctuation-relations";

export const EnglishPunctuationSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishPunctuationInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishPunctuationInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishPunctuationLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishPunctuationMorphologicalRelationsSchema,
	pos: "PUNCT",
});
