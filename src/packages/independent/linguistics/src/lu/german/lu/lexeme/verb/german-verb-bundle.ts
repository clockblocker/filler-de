import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";
import { withLingIdLemmaDtoCompatibility } from "../../../../universal/ling-id-schema-compat";
import {
	GermanVerbInflectionalFeaturesSchema,
	GermanVerbInherentFeaturesSchema,
} from "./parts/german-verb-features";

const GermanVerbLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("VERB"),
} satisfies z.ZodRawShape;

export const GermanVerbIdentityFeatureKeys = ["separable"] as const;

export const GermanVerbLemmaSchema = withLingIdLemmaDtoCompatibility(
	z.object({
		meaningInEmojis: MeaningInEmojisSchema.optional(),
		inherentFeatures: GermanVerbInherentFeaturesSchema,
		lemmaKind: z.literal("Lexeme"),
		language: z.literal("German"),
		pos: z.literal("VERB"),
		canonicalLemma: z.string(),
	}),
) satisfies z.ZodType<AbstractLemma<"Lexeme">>;

export const GermanVerbInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanVerbInflectionalFeaturesSchema,
	language: "German",
	lemmaSchema: GermanVerbLemmaSchema,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Inflection", "Lexeme">
>;

export const GermanVerbLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaSchema: GermanVerbLemmaSchema,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
}) satisfies z.ZodType<AbstractSelectionFor<"Standard", "Lemma", "Lexeme">>;

export const GermanVerbStandardVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaSchema: GermanVerbLemmaSchema,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	surfaceKind: "Variant",
}) satisfies z.ZodType<AbstractSelectionFor<"Standard", "Variant", "Lexeme">>;

export const GermanVerbTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: GermanVerbInflectionalFeaturesSchema,
		language: "German",
		lemmaSchema: GermanVerbLemmaSchema,
		lemmaIdentityShape: GermanVerbLemmaIdentityShape,
		orthographicStatus: "Typo",
	},
) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Inflection", "Lexeme">>;

export const GermanVerbTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaSchema: GermanVerbLemmaSchema,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Lemma", "Lexeme">>;

export const GermanVerbTypoVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaSchema: GermanVerbLemmaSchema,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Variant", "Lexeme">>;
