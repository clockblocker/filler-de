import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { EmojiDescriptionSchema } from "../../../../universal/emoji-description";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import {
	GermanVerbInflectionalFeaturesSchema,
	GermanVerbInherentFeaturesSchema,
} from "./parts/german-verb-features";
import {
	GermanVerbLexicalRelationsSchema,
	GermanVerbMorphologicalRelationsSchema,
} from "./parts/german-verb-relations";

const GermanVerbLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("VERB"),
} satisfies z.ZodRawShape;

export const GermanVerbIdentityFeatureKeys = ["separable"] as const;

export const GermanVerbInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanVerbInflectionalFeaturesSchema,
	language: "German",
	lemmaExtraShape: {
		inherentFeatures: GermanVerbInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Inflection", "Lexeme">
>;

export const GermanVerbLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaExtraShape: {
		inherentFeatures: GermanVerbInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
}) satisfies z.ZodType<AbstractSelectionFor<"Standard", "Lemma", "Lexeme">>;

export const GermanVerbStandardPartialSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaExtraShape: {
		inherentFeatures: GermanVerbInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	surfaceKind: "Partial",
}) satisfies z.ZodType<AbstractSelectionFor<"Standard", "Partial", "Lexeme">>;

export const GermanVerbStandardVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaExtraShape: {
		inherentFeatures: GermanVerbInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	surfaceKind: "Variant",
}) satisfies z.ZodType<AbstractSelectionFor<"Standard", "Variant", "Lexeme">>;

export const GermanVerbTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: GermanVerbInflectionalFeaturesSchema,
		language: "German",
		lemmaExtraShape: {
			inherentFeatures: GermanVerbInherentFeaturesSchema.optional(),
		},
		lemmaIdentityShape: GermanVerbLemmaIdentityShape,
		orthographicStatus: "Typo",
	},
) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Inflection", "Lexeme">>;

export const GermanVerbTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaExtraShape: {
		inherentFeatures: GermanVerbInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Lemma", "Lexeme">>;

export const GermanVerbTypoPartialSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaExtraShape: {
		inherentFeatures: GermanVerbInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Partial",
}) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Partial", "Lexeme">>;

export const GermanVerbTypoVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaExtraShape: {
		inherentFeatures: GermanVerbInherentFeaturesSchema.optional(),
	},
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Variant", "Lexeme">>;

export const GermanVerbLemmaSchema = z.object({
	emojiDescription: EmojiDescriptionSchema.optional(),
	inherentFeatures: GermanVerbInherentFeaturesSchema,
	lemmaKind: z.literal("Lexeme"),
	language: z.literal("German"),
	lexicalRelations: GermanVerbLexicalRelationsSchema,
	morphologicalRelations: GermanVerbMorphologicalRelationsSchema,
	pos: z.literal("VERB"),
	spelledLemma: z.string(),
}) satisfies z.ZodType<AbstractLemma<"Lexeme">>;
