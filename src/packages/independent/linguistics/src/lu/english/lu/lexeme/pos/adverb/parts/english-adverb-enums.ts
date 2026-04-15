import { UniversalFeature } from "../../../../../../universal/enums/feature";

// Source: https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADV.html
export const EnglishAdverbExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"ADV",
	"CCONJ",
	"SCONJ",
]);

export const EnglishAdverbNumForm = UniversalFeature.NumForm.extract(["Word"]);

export const EnglishAdverbNumType = UniversalFeature.NumType.extract([
	"Frac",
	"Mult",
	"Ord",
]);

export const EnglishAdverbPronType = UniversalFeature.PronType.extract([
	"Dem",
	"Ind",
	"Int",
	"Neg",
	"Rel",
	"Tot",
]);

export const EnglishAdverbStyle = UniversalFeature.Style.extract([
	"Expr",
	"Slng",
]);
