import { NumType } from "../../../../../../universal/enums/feature/ud/num-type";
import { PronType } from "../../../../../../universal/enums/feature/ud/pron-type";
import {
	GermanCase,
	GermanDefinite,
	GermanDegree,
	GermanGender,
	GermanNumber,
	GermanPerson,
	GermanPolite,
} from "../../../shared/german-common-enums";

export const GermanDeterminerCase = GermanCase;
export const GermanDeterminerDefinite = GermanDefinite;
export const GermanDeterminerDegree = GermanDegree;
export const GermanDeterminerGender = GermanGender;
export const GermanDeterminerNumber = GermanNumber;
export const GermanDeterminerPerson = GermanPerson;
export const GermanDeterminerPolite = GermanPolite;

export const GermanDeterminerNumType = NumType.extract(["Card", "Ord"]);

export const GermanDeterminerPronType = PronType.extract([
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
