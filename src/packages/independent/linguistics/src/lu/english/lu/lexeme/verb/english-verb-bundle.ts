import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";
import {
	EnglishVerbInflectionalFeaturesSchema,
	EnglishVerbInherentFeaturesSchema,
} from "./parts/english-verb-features";

const EnglishVerbLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("VERB"),
} satisfies z.ZodRawShape;

export const EnglishVerbLemmaSchema = z.object({
	meaningInEmojis: MeaningInEmojisSchema.optional(),
	inherentFeatures: EnglishVerbInherentFeaturesSchema,
	lemmaKind: z.literal("Lexeme"),
	language: z.literal("English"),
	pos: z.literal("VERB"),
	canonicalLemma: z.string(),
}) satisfies z.ZodType<AbstractLemma<"Lexeme", "VERB">>;

export const EnglishVerbInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: EnglishVerbInflectionalFeaturesSchema,
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Inflection", "Lexeme", "VERB">
>;

export const EnglishVerbLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Lemma", "Lexeme", "VERB">
>;

export const EnglishVerbStandardVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	surfaceKind: "Variant",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Variant", "Lexeme", "VERB">
>;

export const EnglishVerbTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: EnglishVerbInflectionalFeaturesSchema,
		language: "English",
		lemmaSchema: EnglishVerbLemmaSchema,
		lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
		orthographicStatus: "Typo",
	},
) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Inflection", "Lexeme", "VERB">
>;

export const EnglishVerbTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Lemma", "Lexeme", "VERB">
>;

export const EnglishVerbTypoVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Variant", "Lexeme", "VERB">
>;
