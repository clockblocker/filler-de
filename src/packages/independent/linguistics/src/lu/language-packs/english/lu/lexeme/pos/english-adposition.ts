import { UniversalFeature } from "../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADP.html
const EnglishAdpositionExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"ADV",
	"SCONJ",
]);

const EnglishAdpositionInflectionalFeaturesSchema = featureSchema({});

const EnglishAdpositionInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishAdpositionExtPos,
});

export const EnglishAdpositionSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAdpositionInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAdpositionInherentFeaturesSchema,
	pos: "ADP",
});
