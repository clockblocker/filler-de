import { UniversalFeature } from "../../../../../../universal/enums/feature";

export const EnglishNounCase = UniversalFeature.Case.extract(["Gen"]);

export const EnglishNounNumber = UniversalFeature.GrammaticalNumber.extract([
	"Plur",
	"Sing",
]);
