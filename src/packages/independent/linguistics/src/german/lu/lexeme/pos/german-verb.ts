import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";

export const GermanVerbInflectionSelectionSchema = z.object({
	orthographicStatus: z.literal("Standard"),
	surface: z.object({
		inflectionalFeatures: z.object({}),
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
	inherentFeatures: z.object({}),
	pos: z.literal("VERB"),
}) satisfies z.ZodType<AbstractLemma<"Lexeme">>;
