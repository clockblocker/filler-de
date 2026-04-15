import { UniversalFeature } from "../../../../universal/enums/feature";

export const EnglishCase = UniversalFeature.Case.extract(["Acc", "Gen", "Nom"]);

export const EnglishDefinite = UniversalFeature.Definite.extract([
	"Def",
	"Ind",
]);

export const EnglishDegree = UniversalFeature.Degree.extract([
	"Cmp",
	"Pos",
	"Sup",
]);

export const EnglishGender = UniversalFeature.Gender.extract([
	"Fem",
	"Masc",
	"Neut",
]);

export const EnglishMood = UniversalFeature.Mood.extract(["Imp", "Ind", "Sub"]);

export const EnglishNumber = UniversalFeature.GrammaticalNumber.extract([
	"Plur",
	"Sing",
]);

export const EnglishPerson = UniversalFeature.Person.extract(["1", "2", "3"]);

export const EnglishPolarity = UniversalFeature.Polarity.extract([
	"Neg",
	"Pos",
]);

export const EnglishTense = UniversalFeature.Tense.extract(["Past", "Pres"]);

export const EnglishVerbForm = UniversalFeature.VerbForm.extract([
	"Fin",
	"Inf",
	"Part",
]);
