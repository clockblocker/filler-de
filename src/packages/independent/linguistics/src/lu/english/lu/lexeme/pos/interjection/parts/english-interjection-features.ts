import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-INTJ.html
// - https://universaldependencies.org/u/feat/Style.html
export const EnglishInterjectionInflectionalFeaturesSchema = featureSchema({});

export const EnglishInterjectionInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	foreign: UniversalFeature.Foreign,
	polarity: EnglishFeature.Polarity,
	style: EnglishFeature.Style.extract(["Expr"]),
});
