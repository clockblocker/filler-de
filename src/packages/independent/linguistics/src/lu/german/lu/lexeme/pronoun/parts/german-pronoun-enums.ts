import z from "zod/v3";
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

export const GermanPronounPronType = z.enum([
	PronType.enum.Dem,
	PronType.enum.Ind,
	PronType.enum.Int,
	PronType.enum.Neg,
	PronType.enum.Prs,
	PronType.enum.Rcp,
	PronType.enum.Rel,
	PronType.enum.Tot,
]);
