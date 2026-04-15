import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";

export const GermanAdpositionInflectionalFeaturesSchema = featureSchema({});

export const GermanAdpositionInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	governedCase: UniversalFeature.GovernedCase.optional(),
});
