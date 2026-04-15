import {
	featureSchema,
	featureSpecificValueSets,
} from "../../../../universal/helpers/schema-targets";
import { HebrewFeature } from "./hebrew-common-enums";

const HebrewVerbalGender = featureSpecificValueSets(HebrewFeature.Gender, [
	["Fem", "Masc"],
]);
const HebrewVerbalNumber = HebrewFeature.Number.extract(["Plur", "Sing"]);
const HebrewVerbalPerson = featureSpecificValueSets(HebrewFeature.Person, [
	["1", "2", "3"],
]);

export const HebrewVerbInflectionalFeaturesSchema = featureSchema({
	definite: HebrewFeature.Definite,
	gender: HebrewVerbalGender,
	mood: HebrewFeature.Mood,
	number: HebrewVerbalNumber,
	person: HebrewVerbalPerson,
	polarity: HebrewFeature.Polarity,
	tense: HebrewFeature.Tense,
	verbForm: HebrewFeature.VerbForm,
	voice: HebrewFeature.Voice,
});

export const HebrewAuxiliaryInflectionalFeaturesSchema = featureSchema({
	gender: HebrewVerbalGender,
	number: HebrewVerbalNumber,
	person: HebrewVerbalPerson,
	polarity: HebrewFeature.Polarity,
	tense: HebrewFeature.Tense,
	verbForm: HebrewFeature.VerbForm,
});
