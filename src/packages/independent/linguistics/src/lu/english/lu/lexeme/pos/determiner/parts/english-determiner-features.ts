import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import {
	EnglishDeterminerNumType,
	EnglishDeterminerPronType,
} from "./english-determiner-enums";

export const EnglishDeterminerInflectionalFeaturesSchema = featureSchema({
	number: EnglishFeature.Number.optional(),
});

export const EnglishDeterminerInherentFeaturesSchema = featureSchema({
	definite: EnglishFeature.Definite.optional(),
	numType: EnglishDeterminerNumType.optional(),
	person: EnglishFeature.Person.optional(),
	poss: UniversalFeature.Poss.optional(),
	pronType: EnglishDeterminerPronType.optional(),
});
