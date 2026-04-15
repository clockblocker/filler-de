import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";

export const GermanNounInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case.optional(),
	number: GermanFeature.Number.optional(),
});

export const GermanNounInherentFeaturesSchema = featureSchema({
	gender: GermanFeature.Gender.optional(),
});
