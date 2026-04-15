import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import { EnglishAdjectiveNumType } from "./english-adjective-enums";

export const EnglishAdjectiveInflectionalFeaturesSchema = featureSchema({
	degree: EnglishFeature.Degree.optional(),
});

export const EnglishAdjectiveInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	numType: EnglishAdjectiveNumType.optional(),
});
