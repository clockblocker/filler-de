import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import { EnglishPronounPronType } from "./english-pronoun-enums";

export const EnglishPronounInflectionalFeaturesSchema = featureSchema({
	case: EnglishFeature.Case.optional(),
	gender: EnglishFeature.Gender.optional(),
	number: EnglishFeature.Number.optional(),
	reflex: UniversalFeature.Reflex.optional(),
});

export const EnglishPronounInherentFeaturesSchema = featureSchema({
	person: EnglishFeature.Person.optional(),
	poss: UniversalFeature.Poss.optional(),
	pronType: EnglishPronounPronType.optional(),
});
