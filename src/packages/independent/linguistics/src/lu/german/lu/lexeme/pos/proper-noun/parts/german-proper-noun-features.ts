import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";

export const GermanProperNounInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case.optional(),
	number: GermanFeature.Number.optional(),
});

export const GermanProperNounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	gender: GermanFeature.Gender.optional(),
});
