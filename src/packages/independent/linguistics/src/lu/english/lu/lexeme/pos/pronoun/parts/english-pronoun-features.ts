import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishCase,
	EnglishGender,
	EnglishNumber,
	EnglishPerson,
} from "../../../shared/english-common-enums";
import { EnglishPronounPronType } from "./english-pronoun-enums";

export const EnglishPronounInflectionalFeaturesSchema = featureSchema({
	case: EnglishCase.optional(),
	gender: EnglishGender.optional(),
	number: EnglishNumber.optional(),
	reflex: UniversalFeature.Reflex.optional(),
});

export const EnglishPronounInherentFeaturesSchema = featureSchema({
	person: EnglishPerson.optional(),
	poss: UniversalFeature.Poss.optional(),
	pronType: EnglishPronounPronType.optional(),
});
