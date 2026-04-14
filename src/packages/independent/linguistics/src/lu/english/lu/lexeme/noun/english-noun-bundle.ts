import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import {
	EnglishNounInflectionalFeaturesSchema,
	EnglishNounInherentFeaturesSchema,
} from "./parts/english-noun-features";

const EnglishNounLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("NOUN"),
} satisfies z.ZodRawShape;

export const EnglishNounInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: EnglishNounInflectionalFeaturesSchema,
	language: "English",
	lemmaExtraShape: {
		inherentFeatures: EnglishNounInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Inflection", "Lexeme", "NOUN">
>;

export const EnglishNounLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaExtraShape: {
		inherentFeatures: EnglishNounInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Lemma", "Lexeme", "NOUN">
>;

export const EnglishNounStandardPartialSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaExtraShape: {
		inherentFeatures: EnglishNounInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	surfaceKind: "Partial",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Partial", "Lexeme", "NOUN">
>;

export const EnglishNounStandardVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaExtraShape: {
		inherentFeatures: EnglishNounInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	surfaceKind: "Variant",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Variant", "Lexeme", "NOUN">
>;

export const EnglishNounTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: EnglishNounInflectionalFeaturesSchema,
		language: "English",
		lemmaExtraShape: {
			inherentFeatures: EnglishNounInherentFeaturesSchema.optional(),
		},
		lemmaIdentityShape: EnglishNounLemmaIdentityShape,
		orthographicStatus: "Typo",
	},
) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Inflection", "Lexeme", "NOUN">
>;

export const EnglishNounTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaExtraShape: {
		inherentFeatures: EnglishNounInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Lemma", "Lexeme", "NOUN">>;

export const EnglishNounTypoPartialSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaExtraShape: {
		inherentFeatures: EnglishNounInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Partial",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Partial", "Lexeme", "NOUN">
>;

export const EnglishNounTypoVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaExtraShape: {
		inherentFeatures: EnglishNounInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Variant", "Lexeme", "NOUN">
>;

export const EnglishNounLemmaSchema = z.object({
	meaningInEmojis: MeaningInEmojisSchema.optional(),
	inherentFeatures: EnglishNounInherentFeaturesSchema,
	lemmaKind: z.literal("Lexeme"),
	language: z.literal("English"),
	pos: z.literal("NOUN"),
	spelledLemma: z.string(),
}) satisfies z.ZodType<AbstractLemma<"Lexeme", "NOUN">>;
