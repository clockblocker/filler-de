import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishNumber } from "../../../shared/english-common-enums";
import { EnglishNounCase } from "./english-noun-enums";

export const EnglishNounInflectionalFeaturesSchema = featureSchema({
	case: EnglishNounCase.optional(),
	number: EnglishNumber.optional(),
});

export const EnglishNounInherentFeaturesSchema = featureSchema({});
