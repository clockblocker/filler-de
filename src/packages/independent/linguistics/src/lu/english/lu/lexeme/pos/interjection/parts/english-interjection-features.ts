import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";

export const EnglishInterjectionInflectionalFeaturesSchema = featureSchema({});

export const EnglishInterjectionInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	foreign: UniversalFeature.Foreign,
	polarity: EnglishFeature.Polarity, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Polarity.html
	style: EnglishFeature.Style.extract(["Expr"]), // https://universaldependencies.org/u/feat/Style.html
});
