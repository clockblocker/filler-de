import { PronType } from "../../../../../universal/enums/feature/ud/pron-type";
import {
	GermanCase,
	GermanGender,
	GermanNumber,
	GermanPerson,
	GermanPolite,
} from "../../shared/german-common-enums";

export const GermanPronounCase = GermanCase;
export const GermanPronounGender = GermanGender;
export const GermanPronounNumber = GermanNumber;
export const GermanPronounPerson = GermanPerson;
export const GermanPronounPolite = GermanPolite;

export const GermanPronounPronType = PronType.extract([
	"Dem",
	"Ind",
	"Int",
	"Neg",
	"Prs",
	"Rcp",
	"Rel",
	"Tot",
]);
