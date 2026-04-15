import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { EnglishFeature } from "../../../shared/english-common-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADV.html
export const EnglishAdverbExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"ADV",
	"CCONJ",
	"SCONJ",
]);

// https://universaldependencies.org/u/feat/NumForm.html
export const EnglishAdverbNumForm = EnglishFeature.NumForm.extract(["Word"]);

// https://universaldependencies.org/u/feat/NumType.html
export const EnglishAdverbNumType = EnglishFeature.NumType.extract([
	"Frac",
	"Mult",
	"Ord",
]);

// https://universaldependencies.org/docs/en/feat/PronType.html
export const EnglishAdverbPronType = EnglishFeature.PronType.extract([
	"Dem",
	"Ind",
	"Int",
	"Neg",
	"Rel",
	"Tot",
]);

// https://universaldependencies.org/u/feat/Style.html
export const EnglishAdverbStyle = EnglishFeature.Style.extract([
	"Expr",
	"Slng",
]);
