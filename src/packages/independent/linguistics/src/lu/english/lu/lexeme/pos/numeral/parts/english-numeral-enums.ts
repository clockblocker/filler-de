import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { EnglishFeature } from "../../../shared/english-common-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-NUM.html
export const EnglishNumeralExtPos = UniversalFeature.ExtPos.extract(["PROPN"]);

// https://universaldependencies.org/u/feat/NumForm.html
export const EnglishNumeralNumForm = EnglishFeature.NumForm.extract([
	"Digit",
	"Roman",
	"Word",
]);

// https://universaldependencies.org/u/feat/NumType.html
export const EnglishNumeralNumType = EnglishFeature.NumType.extract([
	"Card",
	"Frac",
]);
