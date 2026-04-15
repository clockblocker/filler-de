import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { EnglishFeature } from "../../../shared/english-common-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-DET.html
export const EnglishDeterminerExtPos = UniversalFeature.ExtPos.extract([
	"ADV",
	"PRON",
]);

// https://universaldependencies.org/u/feat/NumForm.html
export const EnglishDeterminerNumForm = EnglishFeature.NumForm.extract([
	"Word",
]);

// https://universaldependencies.org/u/feat/NumType.html
export const EnglishDeterminerNumType = EnglishFeature.NumType.extract([
	"Frac",
]);

// https://universaldependencies.org/docs/en/feat/PronType.html
export const EnglishDeterminerPronType = EnglishFeature.PronType.extract([
	"Art",
	"Dem",
	"Ind",
	"Int",
	"Neg",
	"Rcp",
	"Rel",
	"Tot",
]);

// https://universaldependencies.org/u/feat/Style.html
export const EnglishDeterminerStyle = EnglishFeature.Style.extract(["Vrnc"]);
