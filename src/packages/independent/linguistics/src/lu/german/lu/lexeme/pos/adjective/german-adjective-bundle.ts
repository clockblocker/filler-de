import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanAdjectiveInflectionalFeaturesSchema,
	GermanAdjectiveInherentFeaturesSchema,
} from "./parts/german-adjective-features";
import {
	GermanAdjectiveLexicalRelationsSchema,
	GermanAdjectiveMorphologicalRelationsSchema,
} from "./parts/german-adjective-relations";

export const GermanAdjectiveSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAdjectiveInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAdjectiveInherentFeaturesSchema,
	lexicalRelationsSchema: GermanAdjectiveLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanAdjectiveMorphologicalRelationsSchema,
	pos: "ADJ",
});
