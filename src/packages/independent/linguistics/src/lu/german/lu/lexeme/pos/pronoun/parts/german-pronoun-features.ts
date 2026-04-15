import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	GermanCase,
	GermanGender,
	GermanNumber,
	GermanPerson,
	GermanPolite,
} from "../../../shared/german-common-enums";
import { GermanPronounPronType } from "./german-pronoun-enums";

export const GermanPronounInflectionalFeaturesSchema = featureSchema({
	case: GermanCase.optional(),
	gender: GermanGender.optional(),
	number: GermanNumber.optional(),
	reflex: UniversalFeature.Reflex.optional(),
});

export const GermanPronounInherentFeaturesSchema = featureSchema({
	person: GermanPerson.optional(),
	polite: GermanPolite.optional(),
	poss: UniversalFeature.Poss.optional(),
	pronType: GermanPronounPronType.optional(),
});
