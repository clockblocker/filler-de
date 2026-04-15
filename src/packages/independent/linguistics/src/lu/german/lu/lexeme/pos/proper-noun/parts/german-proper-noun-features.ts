import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";

export const GermanProperNounInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	number: GermanFeature.Number,
});

export const GermanProperNounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	foreign: UniversalFeature.Foreign,
	gender: GermanFeature.Gender,
});
