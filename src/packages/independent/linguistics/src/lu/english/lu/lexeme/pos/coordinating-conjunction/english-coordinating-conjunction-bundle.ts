import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishCoordinatingConjunctionInflectionalFeaturesSchema,
	EnglishCoordinatingConjunctionInherentFeaturesSchema,
} from "./parts/english-coordinating-conjunction-features";
import {
	EnglishCoordinatingConjunctionLexicalRelationsSchema,
	EnglishCoordinatingConjunctionMorphologicalRelationsSchema,
} from "./parts/english-coordinating-conjunction-relations";

export const EnglishCoordinatingConjunctionSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema:
		EnglishCoordinatingConjunctionInflectionalFeaturesSchema,
	inherentFeaturesSchema:
		EnglishCoordinatingConjunctionInherentFeaturesSchema,
	lexicalRelationsSchema:
		EnglishCoordinatingConjunctionLexicalRelationsSchema,
	morphologicalRelationsSchema:
		EnglishCoordinatingConjunctionMorphologicalRelationsSchema,
	pos: "CCONJ",
});
