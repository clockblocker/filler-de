import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-CCONJ.html
// - https://universaldependencies.org/u/feat/Typo.html
export const EnglishCoordinatingConjunctionInflectionalFeaturesSchema =
	featureSchema({});

export const EnglishCoordinatingConjunctionInherentFeaturesSchema =
	featureSchema({
		abbr: UniversalFeature.Abbr.optional(),
		polarity: UniversalFeature.Polarity.extract(["Neg"]).optional(),
		typo: UniversalFeature.Typo.optional(),
	});
