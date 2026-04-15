import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanNumeralInflectionalFeaturesSchema,
	GermanNumeralInherentFeaturesSchema,
} from "./parts/german-numeral-features";
import {
	GermanNumeralLexicalRelationsSchema,
	GermanNumeralMorphologicalRelationsSchema,
} from "./parts/german-numeral-relations";

export const GermanNumeralSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanNumeralInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanNumeralInherentFeaturesSchema,
	lexicalRelationsSchema: GermanNumeralLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanNumeralMorphologicalRelationsSchema,
	pos: "NUM",
});
