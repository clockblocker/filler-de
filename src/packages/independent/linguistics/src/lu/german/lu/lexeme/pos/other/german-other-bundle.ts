import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanOtherInflectionalFeaturesSchema,
	GermanOtherInherentFeaturesSchema,
} from "./parts/german-other-features";
import {
	GermanOtherLexicalRelationsSchema,
	GermanOtherMorphologicalRelationsSchema,
} from "./parts/german-other-relations";

export const GermanOtherSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanOtherInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanOtherInherentFeaturesSchema,
	lexicalRelationsSchema: GermanOtherLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanOtherMorphologicalRelationsSchema,
	pos: "X",
});
