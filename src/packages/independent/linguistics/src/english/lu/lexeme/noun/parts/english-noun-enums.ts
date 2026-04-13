import z from "zod/v3";
import { Case } from "../../../../../universal/enums/feature/ud/case";
import { GrammaticalNumber } from "../../../../../universal/enums/feature/ud/number";

export const EnglishNounCase = z.enum([Case.enum.Gen]);

export const EnglishNounNumber = z.enum([
	GrammaticalNumber.enum.Plur,
	GrammaticalNumber.enum.Sing,
]);
