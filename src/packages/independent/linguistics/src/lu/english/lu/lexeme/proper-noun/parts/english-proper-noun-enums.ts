import z from "zod/v3";
import { Case } from "../../../../../universal/enums/feature/ud/case";
import { EnglishNumber } from "../../shared/english-common-enums";

export const EnglishProperNounCase = z.enum([Case.enum.Gen]);
export const EnglishProperNounNumber = EnglishNumber;
