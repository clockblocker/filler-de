import { UniversalFeature } from "../../../../../../universal/enums/feature";

// Source: https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-NUM.html
export const EnglishNumeralExtPos = UniversalFeature.ExtPos.extract(["PROPN"]);

export const EnglishNumeralNumForm = UniversalFeature.NumForm.extract([
	"Digit",
	"Roman",
	"Word",
]);

export const EnglishNumeralNumType = UniversalFeature.NumType.extract([
	"Card",
	"Frac",
]);
