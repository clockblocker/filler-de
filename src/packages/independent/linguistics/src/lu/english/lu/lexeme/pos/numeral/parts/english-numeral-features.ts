import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishCase,
	EnglishGender,
	EnglishNumber,
} from "../../../shared/english-common-enums";
import { EnglishNumeralNumType } from "./english-numeral-enums";

export const EnglishNumeralInflectionalFeaturesSchema = featureSchema({
	case: EnglishCase.optional(),
	gender: EnglishGender.optional(),
	number: EnglishNumber.optional(),
});

export const EnglishNumeralInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	numType: EnglishNumeralNumType.optional(),
});
