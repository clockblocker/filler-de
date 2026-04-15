import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";

export const EnglishAuxiliaryInflectionalFeaturesSchema = featureSchema({
	mood: EnglishFeature.Mood.optional(),
	number: EnglishFeature.Number.optional(),
	person: EnglishFeature.Person.optional(),
	tense: EnglishFeature.Tense.optional(),
	verbForm: EnglishFeature.VerbForm.optional(),
});

export const EnglishAuxiliaryInherentFeaturesSchema = featureSchema({});
