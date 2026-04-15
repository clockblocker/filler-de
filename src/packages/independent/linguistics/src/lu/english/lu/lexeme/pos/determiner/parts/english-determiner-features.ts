import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishDefinite,
	EnglishNumber,
	EnglishPerson,
} from "../../../shared/english-common-enums";
import {
	EnglishDeterminerNumType,
	EnglishDeterminerPronType,
} from "./english-determiner-enums";

export const EnglishDeterminerInflectionalFeaturesSchema = featureSchema({
	number: EnglishNumber.optional(),
});

export const EnglishDeterminerInherentFeaturesSchema = featureSchema({
	definite: EnglishDefinite.optional(),
	numType: EnglishDeterminerNumType.optional(),
	person: EnglishPerson.optional(),
	poss: UniversalFeature.Poss.optional(),
	pronType: EnglishDeterminerPronType.optional(),
});
