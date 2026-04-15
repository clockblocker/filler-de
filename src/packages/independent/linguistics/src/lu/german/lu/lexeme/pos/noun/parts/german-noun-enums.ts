import { UniversalFeature } from "../../../../../../universal/enums/feature";

export const GermanNounCase = UniversalFeature.Case.extract([
	"Acc",
	"Dat",
	"Gen",
	"Nom",
]);

export const GermanNounGender = UniversalFeature.Gender.extract([
	"Fem",
	"Masc",
	"Neut",
]);

export const GermanNounNumber = UniversalFeature.GrammaticalNumber.extract([
	"Plur",
	"Sing",
]);
