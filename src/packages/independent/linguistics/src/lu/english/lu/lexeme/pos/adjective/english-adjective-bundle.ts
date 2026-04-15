import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishAdjectiveInflectionalFeaturesSchema,
	EnglishAdjectiveInherentFeaturesSchema,
} from "./parts/english-adjective-features";
import {
	EnglishAdjectiveLexicalRelationsSchema,
	EnglishAdjectiveMorphologicalRelationsSchema,
} from "./parts/english-adjective-relations";

export const EnglishAdjectiveSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAdjectiveInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAdjectiveInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishAdjectiveLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishAdjectiveMorphologicalRelationsSchema,
	pos: "ADJ",
});
