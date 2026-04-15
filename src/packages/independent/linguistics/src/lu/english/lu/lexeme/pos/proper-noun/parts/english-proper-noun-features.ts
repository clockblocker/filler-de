import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishNumber } from "../../../shared/english-common-enums";
import { EnglishProperNounCase } from "./english-proper-noun-enums";

export const EnglishProperNounInflectionalFeaturesSchema = featureSchema({
	case: EnglishProperNounCase.optional(),
	number: EnglishNumber.optional(),
});

export const EnglishProperNounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
});
