import { UniversalFeature } from "../../../../../../universal/enums/feature";

// Source: https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-DET.html
export const EnglishDeterminerExtPos = UniversalFeature.ExtPos.extract([
	"ADV",
	"PRON",
]);

export const EnglishDeterminerNumForm = UniversalFeature.NumForm.extract([
	"Word",
]);

export const EnglishDeterminerNumType = UniversalFeature.NumType.extract([
	"Frac",
]);

export const EnglishDeterminerPronType = UniversalFeature.PronType.extract([
	"Art",
	"Dem",
	"Ind",
	"Int",
	"Neg",
	"Rcp",
	"Rel",
	"Tot",
]);

export const EnglishDeterminerStyle = UniversalFeature.Style.extract(["Vrnc"]);
