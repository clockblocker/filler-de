import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanPunctuationInflectionalFeaturesSchema,
	GermanPunctuationInherentFeaturesSchema,
} from "./parts/german-punctuation-features";
import {
	GermanPunctuationLexicalRelationsSchema,
	GermanPunctuationMorphologicalRelationsSchema,
} from "./parts/german-punctuation-relations";

export const GermanPunctuationSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanPunctuationInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanPunctuationInherentFeaturesSchema,
	lexicalRelationsSchema: GermanPunctuationLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanPunctuationMorphologicalRelationsSchema,
	pos: "PUNCT",
});
