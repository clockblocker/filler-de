import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanAdverbInflectionalFeaturesSchema,
	GermanAdverbInherentFeaturesSchema,
} from "./parts/german-adverb-features";
import {
	GermanAdverbLexicalRelationsSchema,
	GermanAdverbMorphologicalRelationsSchema,
} from "./parts/german-adverb-relations";

export const GermanAdverbSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAdverbInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAdverbInherentFeaturesSchema,
	lexicalRelationsSchema: GermanAdverbLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanAdverbMorphologicalRelationsSchema,
	pos: "ADV",
});
