import { UniversalFeature } from "../../../../../../universal/enums/feature";
import {
	featureSchema,
	featureSpecificValueSets,
} from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";
import { GermanPronounPronType } from "./german-pronoun-enums";

export const GermanPronounInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	gender: GermanFeature.Gender,
	number: GermanFeature.Number,
	reflex: UniversalFeature.Reflex,
});

export const GermanPronounInherentFeaturesSchema = featureSchema({
	extPos: UniversalFeature.ExtPos.extract(["DET"]),
	foreign: UniversalFeature.Foreign,
	person: GermanFeature.Person,
	polite: GermanFeature.Polite,
	poss: UniversalFeature.Poss,
	pronType: featureSpecificValueSets(GermanPronounPronType, [
		["Dem", "Rel"],
		["Int", "Rel"],
	]),
});
