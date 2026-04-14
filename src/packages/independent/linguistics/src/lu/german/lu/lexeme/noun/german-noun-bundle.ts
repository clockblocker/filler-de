import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";
import { withLingIdLemmaDtoCompatibility } from "../../../../universal/ling-id-schema-compat";
import {
	GermanNounInflectionalFeaturesSchema,
	GermanNounInherentFeaturesSchema,
} from "./parts/german-noun-features";

const GermanNounLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("NOUN"),
} satisfies z.ZodRawShape;

export const GermanNounIdentityFeatureKeys = ["gender"] as const;

export const GermanNounLemmaSchema = withLingIdLemmaDtoCompatibility(
	z.object({
		inherentFeatures: GermanNounInherentFeaturesSchema,
		language: z.literal("German"),
		lemmaKind: z.literal("Lexeme"),
		meaningInEmojis: MeaningInEmojisSchema.optional(),
		pos: z.literal("NOUN"),
		canonicalLemma: z.string(),
	}),
) satisfies z.ZodType<AbstractLemma<"Lexeme", "NOUN">>;

export const GermanNounInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanNounInflectionalFeaturesSchema,
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Inflection", "Lexeme", "NOUN">
>;

export const GermanNounLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Lemma", "Lexeme", "NOUN">
>;

export const GermanNounStandardVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
	surfaceKind: "Variant",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Variant", "Lexeme", "NOUN">
>;

export const GermanNounTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: GermanNounInflectionalFeaturesSchema,
		language: "German",
		lemmaIdentityShape: GermanNounLemmaIdentityShape,
		lemmaSchema: GermanNounLemmaSchema,
		orthographicStatus: "Typo",
	},
) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Inflection", "Lexeme", "NOUN">
>;

export const GermanNounTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
	orthographicStatus: "Typo",
}) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Lemma", "Lexeme", "NOUN">>;

export const GermanNounTypoVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Variant", "Lexeme", "NOUN">
>;
