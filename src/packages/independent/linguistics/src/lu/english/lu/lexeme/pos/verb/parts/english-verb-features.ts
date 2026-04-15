import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishMood,
	EnglishNumber,
	EnglishPerson,
	EnglishTense,
	EnglishVerbForm,
} from "../../../shared/english-common-enums";

export const EnglishVerbInflectionalFeaturesSchema = featureSchema({
	mood: EnglishMood.optional(),
	number: EnglishNumber.optional(),
	person: EnglishPerson.optional(),
	tense: EnglishTense.optional(),
	verbForm: EnglishVerbForm.optional(),
});

export const EnglishVerbInherentFeaturesSchema = featureSchema({
	governedPreposition: UniversalFeature.GovernedPreposition.optional(),
	phrasal: UniversalFeature.Phrasal.optional(),
});
