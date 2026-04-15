import { NumType } from "../../../../../../universal/enums/feature/ud/num-type";
import { PronType } from "../../../../../../universal/enums/feature/ud/pron-type";
import {
	EnglishDefinite,
	EnglishNumber,
	EnglishPerson,
} from "../../../shared/english-common-enums";

export const EnglishDeterminerDefinite = EnglishDefinite;
export const EnglishDeterminerNumber = EnglishNumber;
export const EnglishDeterminerPerson = EnglishPerson;

export const EnglishDeterminerNumType = NumType.extract(["Card", "Ord"]);

export const EnglishDeterminerPronType = PronType.extract([
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
