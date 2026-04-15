import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	GermanCase,
	GermanDegree,
	GermanGender,
	GermanNumber,
} from "../../../shared/german-common-enums";
import { GermanAdjectiveNumType } from "./german-adjective-enums";

export const GermanAdjectiveInflectionalFeaturesSchema = featureSchema({
	case: GermanCase.optional(),
	degree: GermanDegree.optional(),
	gender: GermanGender.optional(),
	number: GermanNumber.optional(),
});

export const GermanAdjectiveInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	numType: GermanAdjectiveNumType.optional(),
});
