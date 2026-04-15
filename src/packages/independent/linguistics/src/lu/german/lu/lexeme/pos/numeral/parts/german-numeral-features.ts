import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";
import { GermanNumeralNumType } from "./german-numeral-enums";

export const GermanNumeralInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case.optional(),
	gender: GermanFeature.Gender.optional(),
	number: GermanFeature.Number.optional(),
});

export const GermanNumeralInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	numType: GermanNumeralNumType.optional(),
});
