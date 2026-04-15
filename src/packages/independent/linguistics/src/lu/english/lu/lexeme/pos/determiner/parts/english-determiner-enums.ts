import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { EnglishFeature } from "../../../shared/english-common-enums";

// Source: https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-DET.html
export const EnglishDeterminerExtPos = UniversalFeature.ExtPos.extract([
	"ADV",
	"PRON",
]);

export const EnglishDeterminerNumForm = EnglishFeature.NumForm.extract([
	"Word",
]);

export const EnglishDeterminerNumType = EnglishFeature.NumType.extract([
	"Frac",
]);

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

export const EnglishDeterminerStyle = EnglishFeature.Style.extract(["Vrnc"]);
