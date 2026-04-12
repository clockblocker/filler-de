import z from "zod/v3";
import { Gender } from "../../../../../universal/enums/feature/ud/gender";
import { Mood } from "../../../../../universal/enums/feature/ud/mood";
import { GrammaticalNumber } from "../../../../../universal/enums/feature/ud/number";
import { Person } from "../../../../../universal/enums/feature/ud/person";
import { Tense } from "../../../../../universal/enums/feature/ud/tense";
import { VerbForm } from "../../../../../universal/enums/feature/ud/verb-form";

export const GermanVerbGender = z.enum([
	Gender.enum.Fem,
	Gender.enum.Masc,
	Gender.enum.Neut,
]);

export const GermanVerbMood = z.enum([
	Mood.enum.Imp,
	Mood.enum.Ind,
	Mood.enum.Sub,
]);

export const GermanVerbNumber = z.enum([
	GrammaticalNumber.enum.Plur,
	GrammaticalNumber.enum.Sing,
]);

export const GermanVerbPerson = z.enum([
	Person.enum["1"],
	Person.enum["2"],
	Person.enum["3"],
]);

export const GermanVerbTense = z.enum([Tense.enum.Past, Tense.enum.Pres]);

export const GermanVerbVerbForm = z.enum([
	VerbForm.enum.Fin,
	VerbForm.enum.Inf,
	VerbForm.enum.Part,
]);
