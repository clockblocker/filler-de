import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";

export const GermanPunctuationInflectionalFeaturesSchema = featureSchema({});

export const GermanPunctuationInherentFeaturesSchema = featureSchema({
	punctType: UniversalFeature.PunctType,
});
