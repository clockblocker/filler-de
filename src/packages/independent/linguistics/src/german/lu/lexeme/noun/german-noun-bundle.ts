import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import {
	GermanNounInflectionalFeaturesSchema,
	GermanNounInherentFeaturesSchema,
} from "./parts/german-noun-features";
import {
	GermanNounLexicalRelationsSchema,
	GermanNounMorphologicalRelationsSchema,
} from "./parts/german-noun-relations";

const GermanNounLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("NOUN"),
} satisfies z.ZodRawShape;

export const GermanNounInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanNounInflectionalFeaturesSchema,
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Inflection", "Lexeme", "NOUN">
>;

export const GermanNounLemmaSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Lemma", "Lexeme", "NOUN">
>;

export const GermanNounStandardPartialSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	surfaceKind: "Partial",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Partial", "Lexeme", "NOUN">
>;

export const GermanNounStandardVariantSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	surfaceKind: "Variant",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Standard", "Variant", "Lexeme", "NOUN">
>;

export const GermanNounTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: GermanNounInflectionalFeaturesSchema,
		lemmaIdentityShape: GermanNounLemmaIdentityShape,
		orthographicStatus: "Typo",
	},
) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Inflection", "Lexeme", "NOUN">
>;

export const GermanNounTypoLemmaSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies z.ZodType<AbstractSelectionFor<"Typo", "Lemma", "Lexeme", "NOUN">>;

export const GermanNounTypoPartialSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Partial",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Partial", "Lexeme", "NOUN">
>;

export const GermanNounTypoVariantSelectionSchema = buildLemmaSelection({
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies z.ZodType<
	AbstractSelectionFor<"Typo", "Variant", "Lexeme", "NOUN">
>;

export const GermanNounLemmaSchema = z.object({
	inherentFeatures: GermanNounInherentFeaturesSchema,
	lexicalRelations: GermanNounLexicalRelationsSchema,
	morphologicalRelations: GermanNounMorphologicalRelationsSchema,
	pos: z.literal("NOUN"),
}) satisfies z.ZodType<AbstractLemma<"Lexeme", "NOUN">>;
