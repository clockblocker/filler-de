import z from "zod/v3";
import { Case } from "../../../../../universal/enums/feature/ud/case";
import { Gender } from "../../../../../universal/enums/feature/ud/gender";
import { GrammaticalNumber } from "../../../../../universal/enums/feature/ud/number";

export const EnglishNounCase = z.enum([
	Case.enum.Acc,
	Case.enum.Dat,
	Case.enum.Gen,
	Case.enum.Nom,
]);

export const EnglishNounGender = z.enum([
	Gender.enum.Fem,
	Gender.enum.Masc,
	Gender.enum.Neut,
]);

export const EnglishNounNumber = z.enum([
	GrammaticalNumber.enum.Plur,
	GrammaticalNumber.enum.Sing,
]);
