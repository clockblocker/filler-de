import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";

export const GermanNounInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	number: GermanFeature.Number,
});

export const GermanNounInherentFeaturesSchema = featureSchema({
	gender: GermanFeature.Gender,
});
