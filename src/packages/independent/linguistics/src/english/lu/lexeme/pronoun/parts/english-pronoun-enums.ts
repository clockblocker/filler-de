import z from "zod/v3";
import { PronType } from "../../../../../universal/enums/feature/ud/pron-type";
import {
	EnglishCase,
	EnglishGender,
	EnglishNumber,
	EnglishPerson,
	EnglishPolite,
} from "../../shared/english-common-enums";

export const EnglishPronounCase = EnglishCase;
export const EnglishPronounGender = EnglishGender;
export const EnglishPronounNumber = EnglishNumber;
export const EnglishPronounPerson = EnglishPerson;
export const EnglishPronounPolite = EnglishPolite;

export const EnglishPronounPronType = z.enum([
	PronType.enum.Dem,
	PronType.enum.Ind,
	PronType.enum.Int,
	PronType.enum.Neg,
	PronType.enum.Prs,
	PronType.enum.Rcp,
	PronType.enum.Rel,
	PronType.enum.Tot,
]);
