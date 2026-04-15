import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanDeterminerInflectionalFeaturesSchema,
	GermanDeterminerInherentFeaturesSchema,
} from "./parts/german-determiner-features";
import {
	GermanDeterminerLexicalRelationsSchema,
	GermanDeterminerMorphologicalRelationsSchema,
} from "./parts/german-determiner-relations";

export const GermanDeterminerSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanDeterminerInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanDeterminerInherentFeaturesSchema,
	lexicalRelationsSchema: GermanDeterminerLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanDeterminerMorphologicalRelationsSchema,
	pos: "DET",
});
