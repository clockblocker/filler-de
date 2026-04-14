import z from "zod/v3";
import { NumType } from "../../../../../universal/enums/feature/ud/num-type";
import {
	EnglishCase,
	EnglishGender,
	EnglishNumber,
} from "../../shared/english-common-enums";

export const EnglishNumeralCase = EnglishCase;
export const EnglishNumeralGender = EnglishGender;
export const EnglishNumeralNumber = EnglishNumber;

export const EnglishNumeralNumType = z.enum([
	NumType.enum.Card,
	NumType.enum.Frac,
	NumType.enum.Mult,
	NumType.enum.Range,
]);
