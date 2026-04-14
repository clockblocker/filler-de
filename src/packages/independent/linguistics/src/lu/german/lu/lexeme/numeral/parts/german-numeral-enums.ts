import z from "zod/v3";
import { NumType } from "../../../../../universal/enums/feature/ud/num-type";
import {
	GermanCase,
	GermanGender,
	GermanNumber,
} from "../../shared/german-common-enums";

export const GermanNumeralCase = GermanCase;
export const GermanNumeralGender = GermanGender;
export const GermanNumeralNumber = GermanNumber;

export const GermanNumeralNumType = z.enum([
	NumType.enum.Card,
	NumType.enum.Frac,
	NumType.enum.Mult,
	NumType.enum.Range,
]);
