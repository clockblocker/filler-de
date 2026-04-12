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

export const GermanCase = z.enum([
	Case.enum.Acc,
	Case.enum.Dat,
	Case.enum.Gen,
	Case.enum.Nom,
]);

export const GermanDefinite = z.enum([Definite.enum.Def, Definite.enum.Ind]);

export const GermanDegree = z.enum([
	Degree.enum.Cmp,
	Degree.enum.Pos,
	Degree.enum.Sup,
]);

export const GermanGender = z.enum([
	Gender.enum.Fem,
	Gender.enum.Masc,
	Gender.enum.Neut,
]);

export const GermanMood = z.enum([Mood.enum.Imp, Mood.enum.Ind, Mood.enum.Sub]);

export const GermanNumber = z.enum([
	GrammaticalNumber.enum.Plur,
	GrammaticalNumber.enum.Sing,
]);

export const GermanPerson = z.enum([
	Person.enum["1"],
	Person.enum["2"],
	Person.enum["3"],
]);

export const GermanPolarity = z.enum([Polarity.enum.Neg, Polarity.enum.Pos]);

export const GermanPolite = z.enum([Polite.enum.Form]);

export const GermanTense = z.enum([Tense.enum.Past, Tense.enum.Pres]);

export const GermanVerbForm = z.enum([
	VerbForm.enum.Fin,
	VerbForm.enum.Inf,
	VerbForm.enum.Part,
]);
