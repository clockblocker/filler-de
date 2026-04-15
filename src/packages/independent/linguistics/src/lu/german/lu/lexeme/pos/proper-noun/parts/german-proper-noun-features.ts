import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	GermanCase,
	GermanGender,
	GermanNumber,
} from "../../../shared/german-common-enums";

export const GermanProperNounInflectionalFeaturesSchema = featureSchema({
	case: GermanCase.optional(),
	number: GermanNumber.optional(),
});

export const GermanProperNounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	gender: GermanGender.optional(),
});
