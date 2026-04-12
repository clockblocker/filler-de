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

export const GermanVerbInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanVerbInflectionalFeaturesSchema,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Inflection", "Lexeme">
>;

export const GermanVerbLemmaSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
}) satisfies z.ZodType<AbstractSelectionFor<"Standard", "Lemma", "Lexeme">>;

export const GermanVerbStandardPartialSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	surfaceKind: "Partial",
}) satisfies z.ZodType<AbstractSelectionFor<"Standard", "Partial", "Lexeme">>;

export const GermanVerbStandardVariantSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	surfaceKind: "Variant",
}) satisfies z.ZodType<AbstractSelectionFor<"Standard", "Variant", "Lexeme">>;

export const GermanVerbTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: GermanVerbInflectionalFeaturesSchema,
		lemmaIdentityShape: GermanVerbLemmaIdentityShape,
		orthographicStatus: "Typo",
	},
) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Inflection", "Lexeme">>;

export const GermanVerbTypoLemmaSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Lemma", "Lexeme">>;

export const GermanVerbTypoPartialSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Partial",
}) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Partial", "Lexeme">>;

export const GermanVerbTypoVariantSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Variant", "Lexeme">>;

export const GermanVerbLemmaSchema = z.object({
	emojiDescription: EmojiDescriptionSchema.optional(),
	inherentFeatures: GermanVerbInherentFeaturesSchema,
	lexicalRelations: GermanVerbLexicalRelationsSchema,
	morphologicalRelations: GermanVerbMorphologicalRelationsSchema,
	pos: z.literal("VERB"),
}) satisfies z.ZodType<AbstractLemma<"Lexeme">>;
