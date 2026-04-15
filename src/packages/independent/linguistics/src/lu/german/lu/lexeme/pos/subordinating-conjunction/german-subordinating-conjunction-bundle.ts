import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanSubordinatingConjunctionInflectionalFeaturesSchema,
	GermanSubordinatingConjunctionInherentFeaturesSchema,
} from "./parts/german-subordinating-conjunction-features";
import {
	GermanSubordinatingConjunctionLexicalRelationsSchema,
	GermanSubordinatingConjunctionMorphologicalRelationsSchema,
} from "./parts/german-subordinating-conjunction-relations";

export const GermanSubordinatingConjunctionSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema:
		GermanSubordinatingConjunctionInflectionalFeaturesSchema,
	inherentFeaturesSchema:
		GermanSubordinatingConjunctionInherentFeaturesSchema,
	lexicalRelationsSchema:
		GermanSubordinatingConjunctionLexicalRelationsSchema,
	morphologicalRelationsSchema:
		GermanSubordinatingConjunctionMorphologicalRelationsSchema,
	pos: "SCONJ",
});
