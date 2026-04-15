import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";
import { GermanPronounPronType } from "./german-pronoun-enums";

export const GermanPronounInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case.optional(),
	gender: GermanFeature.Gender.optional(),
	number: GermanFeature.Number.optional(),
	reflex: UniversalFeature.Reflex.optional(),
});

export const GermanPronounInherentFeaturesSchema = featureSchema({
	person: GermanFeature.Person.optional(),
	polite: GermanFeature.Polite.optional(),
	poss: UniversalFeature.Poss.optional(),
	pronType: GermanPronounPronType.optional(),
});
