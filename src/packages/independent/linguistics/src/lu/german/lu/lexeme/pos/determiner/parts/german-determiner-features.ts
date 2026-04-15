import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";
import {
	GermanDeterminerNumType,
	GermanDeterminerPronType,
} from "./german-determiner-enums";

export const GermanDeterminerInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case.optional(),
	degree: GermanFeature.Degree.optional(),
	gender: GermanFeature.Gender.optional(),
	number: GermanFeature.Number.optional(),
});

export const GermanDeterminerInherentFeaturesSchema = featureSchema({
	definite: GermanFeature.Definite.optional(),
	numType: GermanDeterminerNumType.optional(),
	person: GermanFeature.Person.optional(),
	polite: GermanFeature.Polite.optional(),
	poss: UniversalFeature.Poss.optional(),
	pronType: GermanDeterminerPronType.optional(),
});
