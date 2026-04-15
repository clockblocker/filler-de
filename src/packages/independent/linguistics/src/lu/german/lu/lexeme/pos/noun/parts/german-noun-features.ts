import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	GermanCase,
	GermanGender,
	GermanNumber,
} from "../../../shared/german-common-enums";

export const GermanNounInflectionalFeaturesSchema = featureSchema({
	case: GermanCase.optional(),
	number: GermanNumber.optional(),
});

export const GermanNounInherentFeaturesSchema = featureSchema({
	gender: GermanGender.optional(),
});
