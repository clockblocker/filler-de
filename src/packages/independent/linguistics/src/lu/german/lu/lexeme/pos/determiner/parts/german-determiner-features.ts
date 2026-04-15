import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	GermanCase,
	GermanDefinite,
	GermanDegree,
	GermanGender,
	GermanNumber,
	GermanPerson,
	GermanPolite,
} from "../../../shared/german-common-enums";
import {
	GermanDeterminerNumType,
	GermanDeterminerPronType,
} from "./german-determiner-enums";

export const GermanDeterminerInflectionalFeaturesSchema = featureSchema({
	case: GermanCase.optional(),
	degree: GermanDegree.optional(),
	gender: GermanGender.optional(),
	number: GermanNumber.optional(),
});

export const GermanDeterminerInherentFeaturesSchema = featureSchema({
	definite: GermanDefinite.optional(),
	numType: GermanDeterminerNumType.optional(),
	person: GermanPerson.optional(),
	polite: GermanPolite.optional(),
	poss: UniversalFeature.Poss.optional(),
	pronType: GermanDeterminerPronType.optional(),
});
