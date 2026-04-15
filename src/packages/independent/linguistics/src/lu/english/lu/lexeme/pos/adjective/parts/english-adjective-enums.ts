import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { EnglishFeature } from "../../../shared/english-common-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADJ.html
export const EnglishAdjectiveExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"ADV",
	"SCONJ",
]);

// https://universaldependencies.org/u/feat/NumForm.html
export const EnglishAdjectiveNumForm = EnglishFeature.NumForm.extract([
	"Combi",
	"Word",
]);

// https://universaldependencies.org/u/feat/NumType.html
export const EnglishAdjectiveNumType = EnglishFeature.NumType.extract([
	"Frac",
	"Ord",
]);

// https://universaldependencies.org/u/feat/Style.html
export const EnglishAdjectiveStyle = EnglishFeature.Style.extract(["Expr"]);
