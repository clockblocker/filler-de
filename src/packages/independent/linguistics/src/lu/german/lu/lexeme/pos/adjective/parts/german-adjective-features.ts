import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";
import { GermanAdjectiveNumType } from "./german-adjective-enums";

export const GermanAdjectiveInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	degree: GermanFeature.Degree,
	gender: GermanFeature.Gender,
	number: GermanFeature.Number,
});

export const GermanAdjectiveInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	foreign: UniversalFeature.Foreign,
	numType: GermanAdjectiveNumType,
});
