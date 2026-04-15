import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-CCONJ.html
export const EnglishCoordinatingConjunctionInflectionalFeaturesSchema =
	featureSchema({});

export const EnglishCoordinatingConjunctionInherentFeaturesSchema =
	featureSchema({
		abbr: UniversalFeature.Abbr,
		polarity: UniversalFeature.Polarity.extract(["Neg"]),
	});
