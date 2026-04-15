import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanProperNounInflectionalFeaturesSchema,
	GermanProperNounInherentFeaturesSchema,
} from "./parts/german-proper-noun-features";
import {
	GermanProperNounLexicalRelationsSchema,
	GermanProperNounMorphologicalRelationsSchema,
} from "./parts/german-proper-noun-relations";

export const GermanProperNounSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanProperNounInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanProperNounInherentFeaturesSchema,
	lexicalRelationsSchema: GermanProperNounLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanProperNounMorphologicalRelationsSchema,
	pos: "PROPN",
});
