import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanAdpositionInflectionalFeaturesSchema,
	GermanAdpositionInherentFeaturesSchema,
} from "./parts/german-adposition-features";
import {
	GermanAdpositionLexicalRelationsSchema,
	GermanAdpositionMorphologicalRelationsSchema,
} from "./parts/german-adposition-relations";

export const GermanAdpositionSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAdpositionInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAdpositionInherentFeaturesSchema,
	lexicalRelationsSchema: GermanAdpositionLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanAdpositionMorphologicalRelationsSchema,
	pos: "ADP",
});
