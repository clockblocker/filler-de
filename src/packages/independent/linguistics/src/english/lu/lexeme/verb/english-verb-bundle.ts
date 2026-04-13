import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { EmojiDescriptionSchema } from "../../../../universal/emoji-description";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import {
	EnglishVerbInflectionalFeaturesSchema,
	EnglishVerbInherentFeaturesSchema,
} from "./parts/english-verb-features";
import {
	EnglishVerbLexicalRelationsSchema,
	EnglishVerbMorphologicalRelationsSchema,
} from "./parts/english-verb-relations";

const EnglishVerbLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("VERB"),
} satisfies z.ZodRawShape;

export const EnglishVerbInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: EnglishVerbInflectionalFeaturesSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Inflection", "Lexeme", "VERB">
>;

export const EnglishVerbLemmaSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Lemma", "Lexeme", "VERB">
>;

export const EnglishVerbStandardPartialSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	surfaceKind: "Partial",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Partial", "Lexeme", "VERB">
>;

export const EnglishVerbStandardVariantSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	surfaceKind: "Variant",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Variant", "Lexeme", "VERB">
>;

export const EnglishVerbTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: EnglishVerbInflectionalFeaturesSchema,
		lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
		orthographicStatus: "Typo",
	},
) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Inflection", "Lexeme", "VERB">
>;

export const EnglishVerbTypoLemmaSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Lemma", "Lexeme", "VERB">
>;

export const EnglishVerbTypoPartialSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Partial",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Partial", "Lexeme", "VERB">
>;

export const EnglishVerbTypoVariantSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Variant", "Lexeme", "VERB">
>;

export const EnglishVerbLemmaSchema = z.object({
	emojiDescription: EmojiDescriptionSchema.optional(),
	inherentFeatures: EnglishVerbInherentFeaturesSchema,
	lexicalRelations: EnglishVerbLexicalRelationsSchema,
	morphologicalRelations: EnglishVerbMorphologicalRelationsSchema,
	pos: z.literal("VERB"),
}) satisfies z.ZodType<AbstractLemma<"Lexeme", "VERB">>;
