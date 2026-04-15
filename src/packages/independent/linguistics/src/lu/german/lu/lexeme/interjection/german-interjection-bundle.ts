import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanInterjectionInflectionalFeaturesSchema,
	GermanInterjectionInherentFeaturesSchema,
} from "./parts/german-interjection-features";
import {
	GermanInterjectionLexicalRelationsSchema,
	GermanInterjectionMorphologicalRelationsSchema,
} from "./parts/german-interjection-relations";

export const GermanInterjectionSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanInterjectionInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanInterjectionInherentFeaturesSchema,
	lexicalRelationsSchema: GermanInterjectionLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanInterjectionMorphologicalRelationsSchema,
	pos: "INTJ",
});
