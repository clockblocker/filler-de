import { UniversalFeature } from "../../../../../../universal/enums/feature";

export const GermanVerbGender = UniversalFeature.Gender.extract([
	"Fem",
	"Masc",
	"Neut",
]);

export const GermanVerbMood = UniversalFeature.Mood.extract([
	"Imp",
	"Ind",
	"Sub",
]);

export const GermanVerbNumber = UniversalFeature.GrammaticalNumber.extract([
	"Plur",
	"Sing",
]);

export const GermanVerbPerson = UniversalFeature.Person.extract([
	"1",
	"2",
	"3",
]);

export const GermanVerbTense = UniversalFeature.Tense.extract(["Past", "Pres"]);

export const GermanVerbVerbForm = UniversalFeature.VerbForm.extract([
	"Fin",
	"Inf",
	"Part",
]);
