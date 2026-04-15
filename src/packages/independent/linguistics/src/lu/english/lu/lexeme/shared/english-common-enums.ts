import { UniversalFeature } from "../../../../universal/enums/feature";

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-VerbForm.html
// - https://universaldependencies.org/u/feat/NumForm.html
// - https://universaldependencies.org/u/feat/Style.html
export const EnglishFeature = {
	Case: UniversalFeature.Case.extract(["Acc", "Gen", "Nom"]),
	Definite: UniversalFeature.Definite.extract(["Def", "Ind"]),
	Degree: UniversalFeature.Degree.extract(["Cmp", "Pos", "Sup"]),
	Gender: UniversalFeature.Gender.extract(["Fem", "Masc", "Neut"]),
	Mood: UniversalFeature.Mood.extract(["Imp", "Ind", "Sub"]),
	Number: UniversalFeature.GrammaticalNumber.extract([
		"Plur",
		"Ptan",
		"Sing",
	]),
	NumForm: UniversalFeature.NumForm.extract([
		"Combi",
		"Digit",
		"Roman",
		"Word",
	]),
	Person: UniversalFeature.Person.extract(["1", "2", "3"]),
	Polarity: UniversalFeature.Polarity.extract(["Neg", "Pos"]),
	Style: UniversalFeature.Style.extract([
		"Arch",
		"Coll",
		"Expr",
		"Slng",
		"Vrnc",
	]),
	Tense: UniversalFeature.Tense.extract(["Past", "Pres"]),
	VerbForm: UniversalFeature.VerbForm.extract(["Fin", "Ger", "Inf", "Part"]),
};
