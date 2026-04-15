import { UniversalFeature } from "../../../../universal/enums/feature";

export const HebrewFeature = {
	Case: UniversalFeature.Case.extract(["Acc", "Gen", "Tem"]),
	Definite: UniversalFeature.Definite.extract(["Cons", "Def"]),
	Gender: UniversalFeature.Gender.extract(["Fem", "Masc"]),
	HebBinyan: UniversalFeature.HebBinyan,
	HebExistential: UniversalFeature.HebExistential,
	Mood: UniversalFeature.Mood.extract(["Imp"]),
	Number: UniversalFeature.GrammaticalNumber.extract(["Dual", "Plur", "Sing"]),
	Person: UniversalFeature.Person.extract(["1", "2", "3"]),
	Polarity: UniversalFeature.Polarity.extract(["Neg", "Pos"]),
	Prefix: UniversalFeature.Prefix,
	PronType: UniversalFeature.PronType.extract([
		"Art",
		"Dem",
		"Ind",
		"Int",
		"Prs",
	]),
	Tense: UniversalFeature.Tense.extract(["Fut", "Past"]),
	VerbForm: UniversalFeature.VerbForm.extract(["Inf", "Part"]),
	VerbType: UniversalFeature.VerbType.extract(["Cop", "Mod"]),
	Voice: UniversalFeature.Voice.extract(["Act", "Mid", "Pass"]),
};
