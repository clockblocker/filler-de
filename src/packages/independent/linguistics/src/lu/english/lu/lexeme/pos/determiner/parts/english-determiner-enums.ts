import { UniversalFeature } from "../../../../../../universal/enums/feature";
import {
	EnglishDefinite,
	EnglishNumber,
	EnglishPerson,
} from "../../../shared/english-common-enums";

export const EnglishDeterminerDefinite = EnglishDefinite;
export const EnglishDeterminerNumber = EnglishNumber;
export const EnglishDeterminerPerson = EnglishPerson;

export const EnglishDeterminerNumType = UniversalFeature.NumType.extract([
	"Card",
	"Ord",
]);

export const EnglishDeterminerPronType = UniversalFeature.PronType.extract([
	"Art",
	"Dem",
	"Exc",
	"Ind",
	"Int",
	"Neg",
	"Prs",
	"Rel",
	"Tot",
]);
