import z from "zod/v3";
import { NumType } from "../../../../../universal/enums/feature/ud/num-type";
import { PronType } from "../../../../../universal/enums/feature/ud/pron-type";
import {
	GermanCase,
	GermanDefinite,
	GermanDegree,
	GermanGender,
	GermanNumber,
	GermanPerson,
	GermanPolite,
} from "../../shared/german-common-enums";

export const GermanDeterminerCase = GermanCase;
export const GermanDeterminerDefinite = GermanDefinite;
export const GermanDeterminerDegree = GermanDegree;
export const GermanDeterminerGender = GermanGender;
export const GermanDeterminerNumber = GermanNumber;
export const GermanDeterminerPerson = GermanPerson;
export const GermanDeterminerPolite = GermanPolite;

export const GermanDeterminerNumType = z.enum([
	NumType.enum.Card,
	NumType.enum.Ord,
]);

export const GermanDeterminerPronType = z.enum([
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
