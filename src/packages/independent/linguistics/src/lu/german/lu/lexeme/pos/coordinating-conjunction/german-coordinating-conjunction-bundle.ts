import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanCoordinatingConjunctionInflectionalFeaturesSchema,
	GermanCoordinatingConjunctionInherentFeaturesSchema,
} from "./parts/german-coordinating-conjunction-features";
import {
	GermanCoordinatingConjunctionLexicalRelationsSchema,
	GermanCoordinatingConjunctionMorphologicalRelationsSchema,
} from "./parts/german-coordinating-conjunction-relations";

export const GermanCoordinatingConjunctionSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanCoordinatingConjunctionInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanCoordinatingConjunctionInherentFeaturesSchema,
	lexicalRelationsSchema: GermanCoordinatingConjunctionLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanCoordinatingConjunctionMorphologicalRelationsSchema,
	pos: "CCONJ",
});
