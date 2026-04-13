import z from "zod/v3";
import { NumType } from "../../../../../universal/enums/feature/ud/num-type";
import {
	EnglishCase,
	EnglishGender,
	EnglishMood,
	EnglishNumber,
	EnglishVerbForm,
} from "../../shared/english-common-enums";

export const EnglishOtherCase = EnglishCase;
export const EnglishOtherGender = EnglishGender;
export const EnglishOtherMood = EnglishMood;
export const EnglishOtherNumber = EnglishNumber;
export const EnglishOtherVerbForm = EnglishVerbForm;

export const EnglishOtherNumType = z.enum([
	NumType.enum.Card,
	NumType.enum.Mult,
	NumType.enum.Range,
]);
