import z from "zod/v3";
import { Case } from "../../../../universal/enums/feature/ud/case";
import { Definite } from "../../../../universal/enums/feature/ud/definite";
import { Degree } from "../../../../universal/enums/feature/ud/degree";
import { Gender } from "../../../../universal/enums/feature/ud/gender";
import { Mood } from "../../../../universal/enums/feature/ud/mood";
import { GrammaticalNumber } from "../../../../universal/enums/feature/ud/number";
import { Person } from "../../../../universal/enums/feature/ud/person";
import { Polarity } from "../../../../universal/enums/feature/ud/polarity";
import { Polite } from "../../../../universal/enums/feature/ud/polite";
import { Tense } from "../../../../universal/enums/feature/ud/tense";
import { VerbForm } from "../../../../universal/enums/feature/ud/verb-form";

export const EnglishCase = z.enum([
	Case.enum.Acc,
	Case.enum.Dat,
	Case.enum.Gen,
	Case.enum.Nom,
]);

export const EnglishDefinite = z.enum([Definite.enum.Def, Definite.enum.Ind]);

export const EnglishDegree = z.enum([
	Degree.enum.Cmp,
	Degree.enum.Pos,
	Degree.enum.Sup,
]);

export const EnglishGender = z.enum([
	Gender.enum.Fem,
	Gender.enum.Masc,
	Gender.enum.Neut,
]);

export const EnglishMood = z.enum([Mood.enum.Imp, Mood.enum.Ind, Mood.enum.Sub]);

export const EnglishNumber = z.enum([
	GrammaticalNumber.enum.Plur,
	GrammaticalNumber.enum.Sing,
]);

export const EnglishPerson = z.enum([
	Person.enum["1"],
	Person.enum["2"],
	Person.enum["3"],
]);

export const EnglishPolarity = z.enum([Polarity.enum.Neg, Polarity.enum.Pos]);

export const EnglishPolite = z.enum([Polite.enum.Form]);

export const EnglishTense = z.enum([Tense.enum.Past, Tense.enum.Pres]);

export const EnglishVerbForm = z.enum([
	VerbForm.enum.Fin,
	VerbForm.enum.Inf,
	VerbForm.enum.Part,
]);
