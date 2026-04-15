import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishOtherInflectionalFeaturesSchema,
	EnglishOtherInherentFeaturesSchema,
} from "./parts/english-other-features";
import {
	EnglishOtherLexicalRelationsSchema,
	EnglishOtherMorphologicalRelationsSchema,
} from "./parts/english-other-relations";

export const EnglishOtherSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishOtherInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishOtherInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishOtherLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishOtherMorphologicalRelationsSchema,
	pos: "X",
});
