import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishSubordinatingConjunctionInflectionalFeaturesSchema,
	EnglishSubordinatingConjunctionInherentFeaturesSchema,
} from "./parts/english-subordinating-conjunction-features";
import {
	EnglishSubordinatingConjunctionLexicalRelationsSchema,
	EnglishSubordinatingConjunctionMorphologicalRelationsSchema,
} from "./parts/english-subordinating-conjunction-relations";

export const EnglishSubordinatingConjunctionSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema:
		EnglishSubordinatingConjunctionInflectionalFeaturesSchema,
	inherentFeaturesSchema:
		EnglishSubordinatingConjunctionInherentFeaturesSchema,
	lexicalRelationsSchema:
		EnglishSubordinatingConjunctionLexicalRelationsSchema,
	morphologicalRelationsSchema:
		EnglishSubordinatingConjunctionMorphologicalRelationsSchema,
	pos: "SCONJ",
});
