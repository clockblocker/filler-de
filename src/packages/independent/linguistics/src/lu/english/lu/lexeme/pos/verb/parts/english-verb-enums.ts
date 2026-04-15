import { UniversalFeature } from "../../../../../../universal/enums/feature";

export const EnglishVerbMood = UniversalFeature.Mood.extract([
	"Imp",
	"Ind",
	"Sub",
]);

export const EnglishVerbNumber = UniversalFeature.GrammaticalNumber.extract([
	"Plur",
	"Sing",
]);

export const EnglishVerbPerson = UniversalFeature.Person.extract([
	"1",
	"2",
	"3",
]);

export const EnglishVerbTense = UniversalFeature.Tense.extract([
	"Past",
	"Pres",
]);

export const EnglishVerbVerbForm = UniversalFeature.VerbForm.extract([
	"Fin",
	"Inf",
	"Part",
]);
