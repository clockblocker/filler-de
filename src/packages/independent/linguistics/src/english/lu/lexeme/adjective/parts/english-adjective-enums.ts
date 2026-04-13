import z from "zod/v3";
import { NumType } from "../../../../../universal/enums/feature/ud/num-type";
import {
	EnglishCase,
	EnglishDegree,
	EnglishGender,
	EnglishNumber,
} from "../../shared/english-common-enums";

export const EnglishAdjectiveCase = EnglishCase;
export const EnglishAdjectiveDegree = EnglishDegree;
export const EnglishAdjectiveGender = EnglishGender;
export const EnglishAdjectiveNumber = EnglishNumber;

export const EnglishAdjectiveNumType = z.enum([
	NumType.enum.Card,
	NumType.enum.Ord,
]);
