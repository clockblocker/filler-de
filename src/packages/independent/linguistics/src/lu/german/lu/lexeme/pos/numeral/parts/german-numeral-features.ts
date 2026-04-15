import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";
import { GermanNumeralNumType } from "./german-numeral-enums";

export const GermanNumeralInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	gender: GermanFeature.Gender,
	number: GermanFeature.Number,
});

export const GermanNumeralInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	foreign: UniversalFeature.Foreign,
	numType: GermanNumeralNumType,
});
