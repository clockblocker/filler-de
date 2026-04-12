import z from "zod/v3";
import { NumType } from "../../../../../universal/enums/feature/ud/num-type";
import {
	GermanCase,
	GermanGender,
	GermanMood,
	GermanNumber,
	GermanVerbForm,
} from "../../shared/german-common-enums";

export const GermanOtherCase = GermanCase;
export const GermanOtherGender = GermanGender;
export const GermanOtherMood = GermanMood;
export const GermanOtherNumber = GermanNumber;
export const GermanOtherVerbForm = GermanVerbForm;

export const GermanOtherNumType = z.enum([
	NumType.enum.Card,
	NumType.enum.Mult,
	NumType.enum.Range,
]);
