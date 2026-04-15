import { UniversalFeature } from "../../../../universal/enums/feature";

export const EnglishFeature = {
	// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Case.html
	Case: UniversalFeature.Case.extract(["Acc", "Gen", "Nom"]),
	// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Definite.html
	Definite: UniversalFeature.Definite.extract(["Def", "Ind"]),
	// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Degree.html
	Degree: UniversalFeature.Degree.extract(["Cmp", "Pos", "Sup"]),
	// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Gender.html
	Gender: UniversalFeature.Gender.extract(["Fem", "Masc", "Neut"]),
	// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Mood.html
	Mood: UniversalFeature.Mood.extract(["Imp", "Ind", "Sub"]),
	// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
	Number: UniversalFeature.GrammaticalNumber.extract([
		"Plur",
		"Ptan",
		"Sing",
	]),
	// https://universaldependencies.org/u/feat/NumForm.html
	NumForm: UniversalFeature.NumForm.extract([
		"Combi",
		"Digit",
		"Roman",
		"Word",
	]),
	// https://universaldependencies.org/u/feat/NumType.html
	NumType: UniversalFeature.NumType.extract(["Card", "Frac", "Mult", "Ord"]),
	// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Person.html
	Person: UniversalFeature.Person.extract(["1", "2", "3"]),
	// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Polarity.html
	Polarity: UniversalFeature.Polarity.extract(["Neg", "Pos"]),
	// https://universaldependencies.org/u/feat/PronType.html
	PronType: UniversalFeature.PronType.extract([
		"Art",
		"Dem",
		"Emp",
		"Ind",
		"Int",
		"Neg",
		"Prs",
		"Rcp",
		"Rel",
		"Tot",
	]),
	// https://universaldependencies.org/u/feat/Style.html
	Style: UniversalFeature.Style.extract([
		"Arch",
		"Coll",
		"Expr",
		"Slng",
		"Vrnc",
	]),
	// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Tense.html
	Tense: UniversalFeature.Tense.extract(["Past", "Pres"]),
	// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-VerbForm.html
	VerbForm: UniversalFeature.VerbForm.extract(["Fin", "Ger", "Inf", "Part"]),
};
