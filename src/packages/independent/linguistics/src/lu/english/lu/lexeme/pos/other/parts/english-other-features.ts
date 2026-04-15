import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishCase,
	EnglishGender,
	EnglishMood,
	EnglishNumber,
	EnglishVerbForm,
} from "../../../shared/english-common-enums";
import { EnglishOtherNumType } from "./english-other-enums";

export const EnglishOtherInflectionalFeaturesSchema = featureSchema({
	case: EnglishCase.optional(),
	gender: EnglishGender.optional(),
	mood: EnglishMood.optional(),
	number: EnglishNumber.optional(),
	verbForm: EnglishVerbForm.optional(),
});

export const EnglishOtherInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	numType: EnglishOtherNumType.optional(),
});
