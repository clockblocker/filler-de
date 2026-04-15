import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";

const EnglishProperNounExtPos = UniversalFeature.ExtPos.extract(["PROPN"]);
const EnglishProperNounStyle = EnglishFeature.Style.extract(["Expr"]);

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-PROPN.html
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
// - https://universaldependencies.org/u/feat/Style.html
export const EnglishProperNounInflectionalFeaturesSchema = featureSchema({
	number: EnglishFeature.Number,
});

export const EnglishProperNounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishProperNounExtPos,
	style: EnglishProperNounStyle,
});
