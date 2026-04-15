import { UniversalFeature } from "../../../../universal/enums/feature";

export const GermanFeature = {
	Case: UniversalFeature.Case.extract(["Acc", "Dat", "Gen", "Nom"]),
	Definite: UniversalFeature.Definite.extract(["Def", "Ind"]),
	Degree: UniversalFeature.Degree.extract(["Cmp", "Pos", "Sup"]),
	Gender: UniversalFeature.Gender.extract(["Fem", "Masc", "Neut"]),
	Mood: UniversalFeature.Mood.extract(["Imp", "Ind", "Sub"]),
	Number: UniversalFeature.GrammaticalNumber.extract(["Plur", "Sing"]),
	Person: UniversalFeature.Person.extract(["1", "2", "3"]),
	Polarity: UniversalFeature.Polarity.extract(["Neg", "Pos"]),
	Polite: UniversalFeature.Polite.extract(["Form", "Infm"]),
	Tense: UniversalFeature.Tense.extract(["Past", "Pres"]),
	VerbForm: UniversalFeature.VerbForm.extract(["Fin", "Inf", "Part"]),
};
