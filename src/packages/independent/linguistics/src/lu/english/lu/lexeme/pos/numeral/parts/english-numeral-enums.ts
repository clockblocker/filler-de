import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { EnglishFeature } from "../../../shared/english-common-enums";

// Source: https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-NUM.html
export const EnglishNumeralExtPos = UniversalFeature.ExtPos.extract(["PROPN"]);

export const EnglishNumeralNumForm = EnglishFeature.NumForm.extract([
	"Digit",
	"Roman",
	"Word",
]);

export const EnglishNumeralNumType = EnglishFeature.NumType.extract([
	"Card",
	"Frac",
]);
