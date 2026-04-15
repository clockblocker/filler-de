import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-INTJ.html
// - https://universaldependencies.org/u/feat/Style.html
// - https://universaldependencies.org/u/feat/Typo.html
export const EnglishInterjectionInflectionalFeaturesSchema = featureSchema({});

export const EnglishInterjectionInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	polarity: UniversalFeature.Polarity.extract(["Neg", "Pos"]).optional(),
	style: UniversalFeature.Style.extract(["Expr"]).optional(),
	typo: UniversalFeature.Typo.optional(),
});
