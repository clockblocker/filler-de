import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";
import {
	GermanDeterminerNumType,
	GermanDeterminerPronType,
} from "./german-determiner-enums";

export const GermanDeterminerInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	degree: GermanFeature.Degree,
	gender: GermanFeature.Gender,
	number: GermanFeature.Number,
});

export const GermanDeterminerInherentFeaturesSchema = featureSchema({
	definite: GermanFeature.Definite,
	numType: GermanDeterminerNumType,
	person: GermanFeature.Person,
	polite: GermanFeature.Polite,
	poss: UniversalFeature.Poss,
	pronType: GermanDeterminerPronType,
});
