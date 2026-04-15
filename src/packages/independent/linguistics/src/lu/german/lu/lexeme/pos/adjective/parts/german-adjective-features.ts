import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";
import { GermanAdjectiveNumType } from "./german-adjective-enums";

export const GermanAdjectiveInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case.optional(),
	degree: GermanFeature.Degree.optional(),
	gender: GermanFeature.Gender.optional(),
	number: GermanFeature.Number.optional(),
});

export const GermanAdjectiveInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	numType: GermanAdjectiveNumType.optional(),
});
