import { UniversalFeature } from "../../../../../../universal/enums/feature";

// Source: https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-PRON.html
export const EnglishPronounExtPos = UniversalFeature.ExtPos.extract([
	"ADV",
	"PRON",
]);

export const EnglishPronounPronType = UniversalFeature.PronType.extract([
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

export const EnglishPronounStyle = UniversalFeature.Style.extract([
	"Arch",
	"Coll",
	"Expr",
	"Slng",
	"Vrnc",
]);
