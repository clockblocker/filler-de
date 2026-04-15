import { PronType } from "../../../../../../universal/enums/feature/ud/pron-type";
import {
	EnglishCase,
	EnglishGender,
	EnglishNumber,
	EnglishPerson,
} from "../../../shared/english-common-enums";

export const EnglishPronounCase = EnglishCase;
export const EnglishPronounGender = EnglishGender;
export const EnglishPronounNumber = EnglishNumber;
export const EnglishPronounPerson = EnglishPerson;

export const EnglishPronounPronType = PronType.extract([
	"Dem",
	"Ind",
	"Int",
	"Neg",
	"Prs",
	"Rcp",
	"Rel",
	"Tot",
]);
