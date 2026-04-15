import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";
import { GermanOtherNumType } from "./german-other-enums";

export const GermanOtherInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case.optional(),
	gender: GermanFeature.Gender.optional(),
	mood: GermanFeature.Mood.optional(),
	number: GermanFeature.Number.optional(),
	verbForm: GermanFeature.VerbForm.optional(),
});

export const GermanOtherInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	numType: GermanOtherNumType.optional(),
});
