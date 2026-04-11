import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import {
	GENDER_KEY,
	Gender,
} from "../../../../universal/enums/feature/ud/gender";
import { MOOD_KEY, Mood } from "../../../../universal/enums/feature/ud/mood";
import {
	GrammaticalNumber,
	NUMBER_KEY,
} from "../../../../universal/enums/feature/ud/number";
import {
	PERSON_KEY,
	Person,
} from "../../../../universal/enums/feature/ud/person";
import { TENSE_KEY, Tense } from "../../../../universal/enums/feature/ud/tense";
import {
	VERB_FORM_KEY,
	VerbForm,
} from "../../../../universal/enums/feature/ud/verb-form";

const GermanVerbInflectionalFeaturesSchema = z.object({
	[GENDER_KEY]: Gender.optional(),
	[MOOD_KEY]: Mood.optional(),
	[NUMBER_KEY]: GrammaticalNumber.optional(),
	[PERSON_KEY]: Person.optional(),
	[TENSE_KEY]: Tense.optional(),
	[VERB_FORM_KEY]: VerbForm.optional(),
}) satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme"
	>["surface"]["inflectionalFeatures"]
>;

const GermanVerbInherentFeaturesSchema = z.object({}) satisfies z.ZodType<
	AbstractLemma<"Lexeme">["inherentFeatures"]
>;

export const GermanVerbInflectionSelectionSchema = z.object({
	orthographicStatus: z.literal("Standard"),
	surface: z.object({
		inflectionalFeatures: GermanVerbInflectionalFeaturesSchema,
		lemma: z.object({
			lemmaKind: z.literal("Lexeme"),
			pos: z.literal("VERB"),
			spelledLemma: z.string(),
		}),
		spelledSurface: z.string(),
		surfaceKind: z.literal("Inflection"),
	}),
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Inflection", "Lexeme">
>;

export const GermanVerbLemmaSelectionSchema = z.object({
	orthographicStatus: z.literal("Standard"),
	surface: z.object({
		lemma: z.object({
			lemmaKind: z.literal("Lexeme"),
			pos: z.literal("VERB"),
			spelledLemma: z.string(),
		}),
		spelledSurface: z.string(),
		surfaceKind: z.literal("Lemma"),
	}),
}) satisfies z.ZodType<AbstractSelectionFor<"Standard", "Lemma", "Lexeme">>;

export const GermanVerbLemmaSchema = z.object({
	inherentFeatures: GermanVerbInherentFeaturesSchema,
	pos: z.literal("VERB"),
}) satisfies z.ZodType<AbstractLemma<"Lexeme">>;
