import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { EnglishFeature } from "../../../shared/english-common-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-PRON.html
export const EnglishPronounExtPos = UniversalFeature.ExtPos.extract([
	"ADV",
	"PRON",
]);

// https://universaldependencies.org/docs/en/feat/PronType.html
export const EnglishPronounPronType = EnglishFeature.PronType.extract([
	"Dem",
	"Emp",
	"Ind",
	"Int",
	"Neg",
	"Prs",
	"Rcp",
	"Rel",
	"Tot",
]);

// https://universaldependencies.org/u/feat/Style.html
export const EnglishPronounStyle = EnglishFeature.Style.extract([
	"Arch",
	"Coll",
	"Expr",
	"Slng",
	"Vrnc",
]);
