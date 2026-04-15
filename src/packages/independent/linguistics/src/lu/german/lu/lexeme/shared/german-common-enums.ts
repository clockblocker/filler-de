import { UniversalFeature } from "../../../../universal/enums/feature";

export const GermanCase = UniversalFeature.Case.extract([
	"Acc",
	"Dat",
	"Gen",
	"Nom",
]);

export const GermanDefinite = UniversalFeature.Definite.extract(["Def", "Ind"]);

export const GermanDegree = UniversalFeature.Degree.extract([
	"Cmp",
	"Pos",
	"Sup",
]);

export const GermanGender = UniversalFeature.Gender.extract([
	"Fem",
	"Masc",
	"Neut",
]);

export const GermanMood = UniversalFeature.Mood.extract(["Imp", "Ind", "Sub"]);

export const GermanNumber = UniversalFeature.GrammaticalNumber.extract([
	"Plur",
	"Sing",
]);

export const GermanPerson = UniversalFeature.Person.extract(["1", "2", "3"]);

export const GermanPolarity = UniversalFeature.Polarity.extract(["Neg", "Pos"]);

export const GermanPolite = UniversalFeature.Polite.extract(["Form", "Infm"]);

export const GermanTense = UniversalFeature.Tense.extract(["Past", "Pres"]);

export const GermanVerbForm = UniversalFeature.VerbForm.extract([
	"Fin",
	"Inf",
	"Part",
]);
