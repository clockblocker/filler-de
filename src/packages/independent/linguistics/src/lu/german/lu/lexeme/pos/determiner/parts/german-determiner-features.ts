import { UniversalFeature } from "../../../../../../universal/enums/feature";
import {
	featureSchema,
	featureSpecificValueSets,
	featureValueSet,
} from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";
import {
	GermanDeterminerNumType,
	GermanDeterminerPronType,
} from "./german-determiner-enums";

export const GermanDeterminerInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	degree: GermanFeature.Degree,
	gender: featureSpecificValueSets(GermanFeature.Gender, [["Masc", "Neut"]]),
	"gender[psor]": featureValueSet(GermanFeature.Gender),
	number: GermanFeature.Number,
	"number[psor]": GermanFeature.Number,
});

export const GermanDeterminerInherentFeaturesSchema = featureSchema({
	definite: GermanFeature.Definite,
	extPos: UniversalFeature.ExtPos.extract(["ADV", "DET"]),
	foreign: UniversalFeature.Foreign,
	numType: GermanDeterminerNumType,
	person: GermanFeature.Person,
	polite: GermanFeature.Polite,
	poss: UniversalFeature.Poss,
	pronType: featureSpecificValueSets(GermanDeterminerPronType, [["Int", "Rel"]]),
});
