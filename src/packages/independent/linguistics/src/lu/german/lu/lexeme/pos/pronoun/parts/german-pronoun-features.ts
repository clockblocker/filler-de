import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";
import { GermanPronounPronType } from "./german-pronoun-enums";

export const GermanPronounInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	gender: GermanFeature.Gender,
	number: GermanFeature.Number,
	reflex: UniversalFeature.Reflex,
});

export const GermanPronounInherentFeaturesSchema = featureSchema({
	person: GermanFeature.Person,
	polite: GermanFeature.Polite,
	poss: UniversalFeature.Poss,
	pronType: GermanPronounPronType,
});
