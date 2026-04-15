import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { EnglishFeature } from "../../../shared/english-common-enums";

// Source: https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADJ.html
export const EnglishAdjectiveExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"ADV",
	"SCONJ",
]);

export const EnglishAdjectiveNumForm = EnglishFeature.NumForm.extract([
	"Combi",
	"Word",
]);

export const EnglishAdjectiveNumType = EnglishFeature.NumType.extract([
	"Frac",
	"Ord",
]);

export const EnglishAdjectiveStyle = EnglishFeature.Style.extract(["Expr"]);
