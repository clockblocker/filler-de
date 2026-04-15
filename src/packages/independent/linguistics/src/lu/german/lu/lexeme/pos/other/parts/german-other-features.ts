import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";
import { GermanOtherNumType } from "./german-other-enums";

export const GermanOtherInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	gender: GermanFeature.Gender,
	mood: GermanFeature.Mood,
	number: GermanFeature.Number,
	verbForm: GermanFeature.VerbForm,
});

export const GermanOtherInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	foreign: UniversalFeature.Foreign,
	hyph: UniversalFeature.Hyph,
	numType: GermanOtherNumType,
});
