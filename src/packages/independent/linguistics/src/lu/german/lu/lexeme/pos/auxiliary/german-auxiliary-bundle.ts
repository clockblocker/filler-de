import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanAuxiliaryInflectionalFeaturesSchema,
	GermanAuxiliaryInherentFeaturesSchema,
} from "./parts/german-auxiliary-features";
import {
	GermanAuxiliaryLexicalRelationsSchema,
	GermanAuxiliaryMorphologicalRelationsSchema,
} from "./parts/german-auxiliary-relations";

export const GermanAuxiliarySchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAuxiliaryInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAuxiliaryInherentFeaturesSchema,
	lexicalRelationsSchema: GermanAuxiliaryLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanAuxiliaryMorphologicalRelationsSchema,
	pos: "AUX",
});
