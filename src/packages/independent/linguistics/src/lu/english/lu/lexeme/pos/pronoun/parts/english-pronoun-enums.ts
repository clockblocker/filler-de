import { UniversalFeature } from "../../../../../../universal/enums/feature";
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

export const EnglishPronounPronType = UniversalFeature.PronType.extract([
	"Dem",
	"Ind",
	"Int",
	"Neg",
	"Prs",
	"Rcp",
	"Rel",
	"Tot",
]);
