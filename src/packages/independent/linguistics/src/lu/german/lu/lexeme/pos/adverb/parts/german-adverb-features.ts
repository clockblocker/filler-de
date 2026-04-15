import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";
import {
	GermanAdverbNumType,
	GermanAdverbPronType,
} from "./german-adverb-enums";

export const GermanAdverbInflectionalFeaturesSchema = featureSchema({
	degree: GermanFeature.Degree.optional(),
});

export const GermanAdverbInherentFeaturesSchema = featureSchema({
	foreign: UniversalFeature.Foreign.optional(),
	numType: GermanAdverbNumType.optional(),
	pronType: GermanAdverbPronType.optional(),
});
