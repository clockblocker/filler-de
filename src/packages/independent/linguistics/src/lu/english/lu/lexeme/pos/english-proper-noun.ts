import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import { EnglishFeature } from "../shared/english-common-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-PROPN.html
const EnglishProperNounExtPos = UniversalFeature.ExtPos.extract(["PROPN"]);
// https://universaldependencies.org/u/feat/Style.html
const EnglishProperNounStyle = EnglishFeature.Style.extract(["Expr"]);

const EnglishProperNounInflectionalFeaturesSchema = featureSchema({
	number: EnglishFeature.Number, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
});

const EnglishProperNounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishProperNounExtPos,
	style: EnglishProperNounStyle,
});

export const EnglishProperNounSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishProperNounInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishProperNounInherentFeaturesSchema,
	pos: "PROPN",
});
