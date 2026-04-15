import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	GermanCase,
	GermanGender,
	GermanNumber,
} from "../../../shared/german-common-enums";
import { GermanNumeralNumType } from "./german-numeral-enums";

export const GermanNumeralInflectionalFeaturesSchema = featureSchema({
	case: GermanCase.optional(),
	gender: GermanGender.optional(),
	number: GermanNumber.optional(),
});

export const GermanNumeralInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	numType: GermanNumeralNumType.optional(),
});
