import { UniversalFeature } from "../../../../../../universal/enums/feature";

// Source: https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADJ.html
export const EnglishAdjectiveExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"ADV",
	"SCONJ",
]);

export const EnglishAdjectiveNumForm = UniversalFeature.NumForm.extract([
	"Combi",
	"Word",
]);

export const EnglishAdjectiveNumType = UniversalFeature.NumType.extract([
	"Frac",
	"Ord",
]);

export const EnglishAdjectiveStyle = UniversalFeature.Style.extract(["Expr"]);
