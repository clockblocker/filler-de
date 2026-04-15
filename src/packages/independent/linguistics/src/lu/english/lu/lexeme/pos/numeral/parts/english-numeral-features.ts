import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import { EnglishNumeralNumType } from "./english-numeral-enums";

export const EnglishNumeralInflectionalFeaturesSchema = featureSchema({
	case: EnglishFeature.Case.optional(),
	gender: EnglishFeature.Gender.optional(),
	number: EnglishFeature.Number.optional(),
});

export const EnglishNumeralInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	numType: EnglishNumeralNumType.optional(),
});
