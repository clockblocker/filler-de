import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { Gender } from "../../../../universal/enums/feature/ud/gender";
import { Mood } from "../../../../universal/enums/feature/ud/mood";
import { GrammaticalNumber } from "../../../../universal/enums/feature/ud/number";
import { Person } from "../../../../universal/enums/feature/ud/person";
import { Tense } from "../../../../universal/enums/feature/ud/tense";
import { VerbForm } from "../../../../universal/enums/feature/ud/verb-form";

const GermanVerbInflectionalFeaturesSchema = z.object({
	gender: Gender.optional(),
	mood: Mood.optional(),
	number: GrammaticalNumber.optional(),
	person: Person.optional(),
	tense: Tense.optional(),
	verbForm: VerbForm.optional(),
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
