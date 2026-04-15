import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { EnglishFeature } from "../../../shared/english-common-enums";

// Source: https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADV.html
export const EnglishAdverbExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"ADV",
	"CCONJ",
	"SCONJ",
]);

export const EnglishAdverbNumForm = EnglishFeature.NumForm.extract(["Word"]);

export const EnglishAdverbNumType = EnglishFeature.NumType.extract([
	"Frac",
	"Mult",
	"Ord",
]);

export const EnglishAdverbPronType = EnglishFeature.PronType.extract([
	"Dem",
	"Ind",
	"Int",
	"Neg",
	"Rel",
	"Tot",
]);

export const EnglishAdverbStyle = EnglishFeature.Style.extract([
	"Expr",
	"Slng",
]);
