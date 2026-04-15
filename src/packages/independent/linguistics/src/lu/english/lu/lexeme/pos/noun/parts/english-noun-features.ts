import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";

export const EnglishNounInflectionalFeaturesSchema = featureSchema({
	number: EnglishFeature.Number.optional(),
});

export const EnglishNounInherentFeaturesSchema = featureSchema({});
