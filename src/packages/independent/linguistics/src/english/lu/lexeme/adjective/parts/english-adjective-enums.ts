import z from "zod/v3";
import { NumType } from "../../../../../universal/enums/feature/ud/num-type";
import { EnglishDegree } from "../../shared/english-common-enums";

export const EnglishAdjectiveDegree = EnglishDegree;

export const EnglishAdjectiveNumType = z.enum([
	NumType.enum.Card,
	NumType.enum.Ord,
]);
