import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { SenseEmojisSchema } from "../../../../universal/sense-emojis";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import {
	GermanNounInflectionalFeaturesSchema,
	GermanNounInherentFeaturesSchema,
} from "./parts/german-noun-features";

const GermanNounLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("NOUN"),
} satisfies z.ZodRawShape;

export const GermanNounIdentityFeatureKeys = ["gender"] as const;

export const GermanNounInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanNounInflectionalFeaturesSchema,
	language: "German",
	lemmaExtraShape: {
		inherentFeatures: GermanNounInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Inflection", "Lexeme", "NOUN">
>;

export const GermanNounLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaExtraShape: {
		inherentFeatures: GermanNounInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Lemma", "Lexeme", "NOUN">
>;

export const GermanNounStandardPartialSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaExtraShape: {
		inherentFeatures: GermanNounInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	surfaceKind: "Partial",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Partial", "Lexeme", "NOUN">
>;

export const GermanNounStandardVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaExtraShape: {
		inherentFeatures: GermanNounInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	surfaceKind: "Variant",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Variant", "Lexeme", "NOUN">
>;

export const GermanNounTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: GermanNounInflectionalFeaturesSchema,
		language: "German",
		lemmaExtraShape: {
			inherentFeatures: GermanNounInherentFeaturesSchema.optional(),
		},
		lemmaIdentityShape: GermanNounLemmaIdentityShape,
		orthographicStatus: "Typo",
	},
) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Inflection", "Lexeme", "NOUN">
>;

export const GermanNounTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaExtraShape: {
		inherentFeatures: GermanNounInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Lemma", "Lexeme", "NOUN">>;

export const GermanNounTypoPartialSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaExtraShape: {
		inherentFeatures: GermanNounInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Partial",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Partial", "Lexeme", "NOUN">
>;

export const GermanNounTypoVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaExtraShape: {
		inherentFeatures: GermanNounInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Variant", "Lexeme", "NOUN">
>;

export const GermanNounLemmaSchema = z.object({
	senseEmojis: SenseEmojisSchema.optional(),
	inherentFeatures: GermanNounInherentFeaturesSchema,
	lemmaKind: z.literal("Lexeme"),
	language: z.literal("German"),
	pos: z.literal("NOUN"),
	spelledLemma: z.string(),
}) satisfies z.ZodType<AbstractLemma<"Lexeme", "NOUN">>;
