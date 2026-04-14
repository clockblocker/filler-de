import z from "zod/v3";
import { NumType } from "../../../../../universal/enums/feature/ud/num-type";
import { PronType } from "../../../../../universal/enums/feature/ud/pron-type";
import { EnglishDegree } from "../../shared/english-common-enums";

export const EnglishAdverbDegree = EnglishDegree;

export const EnglishAdverbNumType = z.enum([
	NumType.enum.Card,
	NumType.enum.Mult,
]);

export const EnglishAdverbPronType = z.enum([
	PronType.enum.Dem,
	PronType.enum.Int,
	PronType.enum.Rel,
]);
