import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";

export const GermanAdpositionInflectionalFeaturesSchema = featureSchema({});

export const GermanAdpositionInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	adpType: UniversalFeature.AdpType.extract(["Circ", "Post", "Prep"]),
	extPos: UniversalFeature.ExtPos.extract(["ADV", "SCONJ"]),
	foreign: UniversalFeature.Foreign,
	governedCase: UniversalFeature.GovernedCase,
	partType: UniversalFeature.PartType.extract(["Vbp"]),
});
