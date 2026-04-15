import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishMood,
	EnglishNumber,
	EnglishPerson,
	EnglishTense,
	EnglishVerbForm,
} from "../../../shared/english-common-enums";

export const EnglishAuxiliaryInflectionalFeaturesSchema = featureSchema({
	mood: EnglishMood.optional(),
	number: EnglishNumber.optional(),
	person: EnglishPerson.optional(),
	tense: EnglishTense.optional(),
	verbForm: EnglishVerbForm.optional(),
});

export const EnglishAuxiliaryInherentFeaturesSchema = featureSchema({});
