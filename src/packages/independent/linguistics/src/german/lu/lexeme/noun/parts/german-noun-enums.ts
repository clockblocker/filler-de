import z from "zod/v3";
import { Case } from "../../../../../universal/enums/feature/ud/case";
import { Gender } from "../../../../../universal/enums/feature/ud/gender";
import { GrammaticalNumber } from "../../../../../universal/enums/feature/ud/number";

export const GermanNounCase = z.enum([
	Case.enum.Acc,
	Case.enum.Dat,
	Case.enum.Gen,
	Case.enum.Nom,
]);

export const GermanNounGender = z.enum([
	Gender.enum.Fem,
	Gender.enum.Masc,
	Gender.enum.Neut,
]);

export const GermanNounNumber = z.enum([
	GrammaticalNumber.enum.Plur,
	GrammaticalNumber.enum.Sing,
]);
