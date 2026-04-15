import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanPronounInflectionalFeaturesSchema,
	GermanPronounInherentFeaturesSchema,
} from "./parts/german-pronoun-features";
import {
	GermanPronounLexicalRelationsSchema,
	GermanPronounMorphologicalRelationsSchema,
} from "./parts/german-pronoun-relations";

export const GermanPronounSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanPronounInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanPronounInherentFeaturesSchema,
	lexicalRelationsSchema: GermanPronounLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanPronounMorphologicalRelationsSchema,
	pos: "PRON",
});
