import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { EnglishDegree } from "../../../shared/english-common-enums";

export const EnglishAdverbDegree = EnglishDegree;

export const EnglishAdverbNumType = UniversalFeature.NumType.extract([
	"Card",
	"Mult",
]);

export const EnglishAdverbPronType = UniversalFeature.PronType.extract([
	"Dem",
	"Int",
	"Rel",
]);
