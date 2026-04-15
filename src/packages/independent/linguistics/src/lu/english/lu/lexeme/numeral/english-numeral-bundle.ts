import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishNumeralInflectionalFeaturesSchema,
	EnglishNumeralInherentFeaturesSchema,
} from "./parts/english-numeral-features";
import {
	EnglishNumeralLexicalRelationsSchema,
	EnglishNumeralMorphologicalRelationsSchema,
} from "./parts/english-numeral-relations";

export const EnglishNumeralSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishNumeralInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishNumeralInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishNumeralLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishNumeralMorphologicalRelationsSchema,
	pos: "NUM",
});
