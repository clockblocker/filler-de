import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { IsSeparable } from "../../../../universal/enums/feature/custom/separable";
import { Gender } from "../../../../universal/enums/feature/ud/gender";
import { Mood } from "../../../../universal/enums/feature/ud/mood";
import { GrammaticalNumber } from "../../../../universal/enums/feature/ud/number";
import { Person } from "../../../../universal/enums/feature/ud/person";
import { IsReflex } from "../../../../universal/enums/feature/ud/reflex";
import { Tense } from "../../../../universal/enums/feature/ud/tense";
import { VerbForm } from "../../../../universal/enums/feature/ud/verb-form";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";

const GermanVerbGender = z.enum([
	Gender.enum.Fem,
	Gender.enum.Masc,
	Gender.enum.Neut,
]);
const GermanVerbMood = z.enum([Mood.enum.Imp, Mood.enum.Ind, Mood.enum.Sub]);
const GermanVerbNumber = z.enum([
	GrammaticalNumber.enum.Plur,
	GrammaticalNumber.enum.Sing,
]);
const GermanVerbPerson = z.enum([
	Person.enum["1"],
	Person.enum["2"],
	Person.enum["3"],
]);
const GermanVerbTense = z.enum([Tense.enum.Past, Tense.enum.Pres]);
const GermanVerbVerbForm = z.enum([
	VerbForm.enum.Fin,
	VerbForm.enum.Inf,
	VerbForm.enum.Part,
]);

const GermanVerbInflectionalFeaturesSchema = z.object({
	gender: GermanVerbGender.optional(),
	mood: GermanVerbMood.optional(),
	number: GermanVerbNumber.optional(),
	person: GermanVerbPerson.optional(),
	tense: GermanVerbTense.optional(),
	verbForm: GermanVerbVerbForm.optional(),
}).strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme"
	>["surface"]["inflectionalFeatures"]
>;

const GermanVerbInherentFeaturesSchema = z.object({
	reflex: IsReflex.optional(),
	separable: IsSeparable.optional(),
}).strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme">["inherentFeatures"]
>;

const GermanVerbLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("VERB"),
} satisfies z.ZodRawShape;

export const GermanVerbInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanVerbInflectionalFeaturesSchema,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Inflection", "Lexeme">
>;

export const GermanVerbLemmaSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
}) satisfies z.ZodType<AbstractSelectionFor<"Standard", "Lemma", "Lexeme">>;

export const GermanVerbLemmaSchema = z.object({
	inherentFeatures: GermanVerbInherentFeaturesSchema,
	pos: z.literal("VERB"),
}) satisfies z.ZodType<AbstractLemma<"Lexeme">>;
