import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import { EnglishOtherNumType } from "./english-other-enums";

export const EnglishOtherInflectionalFeaturesSchema = featureSchema({
	case: EnglishFeature.Case.optional(),
	gender: EnglishFeature.Gender.optional(),
	mood: EnglishFeature.Mood.optional(),
	number: EnglishFeature.Number.optional(),
	verbForm: EnglishFeature.VerbForm.optional(),
});

export const EnglishOtherInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	numType: EnglishOtherNumType.optional(),
});
