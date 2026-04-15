import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { GermanDegree } from "../../../shared/german-common-enums";

export const GermanAdverbDegree = GermanDegree;

export const GermanAdverbNumType = UniversalFeature.NumType.extract([
	"Card",
	"Mult",
]);

export const GermanAdverbPronType = UniversalFeature.PronType.extract([
	"Dem",
	"Int",
	"Rel",
]);
