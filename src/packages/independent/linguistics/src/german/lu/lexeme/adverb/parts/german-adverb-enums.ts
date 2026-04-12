import z from "zod/v3";
import { NumType } from "../../../../../universal/enums/feature/ud/num-type";
import { PronType } from "../../../../../universal/enums/feature/ud/pron-type";
import { GermanDegree } from "../../shared/german-common-enums";

export const GermanAdverbDegree = GermanDegree;

export const GermanAdverbNumType = z.enum([
	NumType.enum.Card,
	NumType.enum.Mult,
]);

export const GermanAdverbPronType = z.enum([
	PronType.enum.Dem,
	PronType.enum.Int,
	PronType.enum.Rel,
]);
