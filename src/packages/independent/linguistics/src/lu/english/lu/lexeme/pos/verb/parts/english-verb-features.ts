import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";

export const EnglishVerbInflectionalFeaturesSchema = featureSchema({
	mood: EnglishFeature.Mood.optional(),
	number: EnglishFeature.Number.optional(),
	person: EnglishFeature.Person.optional(),
	tense: EnglishFeature.Tense.optional(),
	verbForm: EnglishFeature.VerbForm.optional(),
});

export const EnglishVerbInherentFeaturesSchema = featureSchema({
	governedPreposition: UniversalFeature.GovernedPreposition.optional(),
	phrasal: UniversalFeature.Phrasal.optional(),
});
