import z from "zod/v3";
import { NumType } from "../../../../../universal/enums/feature/ud/num-type";
import { PronType } from "../../../../../universal/enums/feature/ud/pron-type";
import {
	EnglishCase,
	EnglishDefinite,
	EnglishDegree,
	EnglishGender,
	EnglishNumber,
	EnglishPerson,
	EnglishPolite,
} from "../../shared/english-common-enums";

export const EnglishDeterminerCase = EnglishCase;
export const EnglishDeterminerDefinite = EnglishDefinite;
export const EnglishDeterminerDegree = EnglishDegree;
export const EnglishDeterminerGender = EnglishGender;
export const EnglishDeterminerNumber = EnglishNumber;
export const EnglishDeterminerPerson = EnglishPerson;
export const EnglishDeterminerPolite = EnglishPolite;

export const EnglishDeterminerNumType = z.enum([
	NumType.enum.Card,
	NumType.enum.Ord,
]);

export const EnglishDeterminerPronType = z.enum([
	PronType.enum.Art,
	PronType.enum.Dem,
	PronType.enum.Exc,
	PronType.enum.Ind,
	PronType.enum.Int,
	PronType.enum.Neg,
	PronType.enum.Prs,
	PronType.enum.Rel,
	PronType.enum.Tot,
]);
