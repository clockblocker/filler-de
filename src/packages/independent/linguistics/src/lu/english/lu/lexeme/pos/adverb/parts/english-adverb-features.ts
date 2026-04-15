import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishDegree } from "../../../shared/english-common-enums";
import {
	EnglishAdverbNumType,
	EnglishAdverbPronType,
} from "./english-adverb-enums";

export const EnglishAdverbInflectionalFeaturesSchema = featureSchema({
	degree: EnglishDegree.optional(),
});

export const EnglishAdverbInherentFeaturesSchema = featureSchema({
	foreign: UniversalFeature.Foreign.optional(),
	numType: EnglishAdverbNumType.optional(),
	pronType: EnglishAdverbPronType.optional(),
});
