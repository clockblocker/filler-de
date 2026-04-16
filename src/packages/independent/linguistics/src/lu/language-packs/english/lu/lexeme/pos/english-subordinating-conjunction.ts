import { UniversalFeature } from "../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import { EnglishFeature } from "../shared/english-common-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-SCONJ.html
const EnglishSubordinatingConjunctionExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"SCONJ",
]);

// https://universaldependencies.org/u/feat/Style.html
const EnglishSubordinatingConjunctionStyle = EnglishFeature.Style.extract([
	"Vrnc",
]);

const EnglishSubordinatingConjunctionInflectionalFeaturesSchema = featureSchema(
	{},
);

const EnglishSubordinatingConjunctionInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishSubordinatingConjunctionExtPos,
	style: EnglishSubordinatingConjunctionStyle,
});

export const EnglishSubordinatingConjunctionSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema:
		EnglishSubordinatingConjunctionInflectionalFeaturesSchema,
	inherentFeaturesSchema:
		EnglishSubordinatingConjunctionInherentFeaturesSchema,
	pos: "SCONJ",
});
