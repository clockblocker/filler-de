import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	GermanCase,
	GermanGender,
	GermanMood,
	GermanNumber,
	GermanVerbForm,
} from "../../../shared/german-common-enums";
import { GermanOtherNumType } from "./german-other-enums";

export const GermanOtherInflectionalFeaturesSchema = featureSchema({
	case: GermanCase.optional(),
	gender: GermanGender.optional(),
	mood: GermanMood.optional(),
	number: GermanNumber.optional(),
	verbForm: GermanVerbForm.optional(),
});

export const GermanOtherInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	numType: GermanOtherNumType.optional(),
});
