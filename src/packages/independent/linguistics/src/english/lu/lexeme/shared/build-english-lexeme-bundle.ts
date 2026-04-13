import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import type { Pos } from "../../../../universal/enums/kind/pos";
import { EmojiDescriptionSchema } from "../../../../universal/emoji-description";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";

type EnglishLexemeBundle<P extends Pos> = {
	InflectionSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Standard", "Inflection", "Lexeme", P>
	>;
	LemmaSchema: z.ZodType<AbstractLemma<"Lexeme", P>>;
	LemmaSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Standard", "Lemma", "Lexeme", P>
	>;
	StandardPartialSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Standard", "Partial", "Lexeme", P>
	>;
	StandardVariantSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Standard", "Variant", "Lexeme", P>
	>;
	TypoInflectionSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Typo", "Inflection", "Lexeme", P>
	>;
	TypoLemmaSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Typo", "Lemma", "Lexeme", P>
	>;
	TypoPartialSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Typo", "Partial", "Lexeme", P>
	>;
	TypoVariantSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Typo", "Variant", "Lexeme", P>
	>;
};

export function buildEnglishLexemeBundle<
	P extends Pos,
	InflectionalFeaturesSchema extends z.ZodTypeAny,
	InherentFeaturesSchema extends z.ZodTypeAny,
	LexicalRelationsSchema extends z.ZodTypeAny,
	MorphologicalRelationsSchema extends z.ZodTypeAny,
>({
	inflectionalFeaturesSchema,
	inherentFeaturesSchema,
	lexicalRelationsSchema,
	morphologicalRelationsSchema,
	pos,
}: {
	inflectionalFeaturesSchema: InflectionalFeaturesSchema;
	inherentFeaturesSchema: InherentFeaturesSchema;
	lexicalRelationsSchema: LexicalRelationsSchema;
	morphologicalRelationsSchema: MorphologicalRelationsSchema;
	pos: P;
}): EnglishLexemeBundle<P> {
	const lemmaIdentityShape = {
		lemmaKind: z.literal("Lexeme"),
		pos: z.literal(pos),
	} satisfies z.ZodRawShape;

	return {
		InflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			language: "English",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
		}) as unknown as EnglishLexemeBundle<P>["InflectionSelectionSchema"],
		LemmaSchema: z.object({
			emojiDescription: EmojiDescriptionSchema.optional(),
			inherentFeatures: inherentFeaturesSchema,
			language: z.literal("English"),
			lexicalRelations: lexicalRelationsSchema,
			morphologicalRelations: morphologicalRelationsSchema,
			pos: z.literal(pos),
			spelledLemma: z.string(),
		}) as unknown as EnglishLexemeBundle<P>["LemmaSchema"],
		LemmaSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
		}) as unknown as EnglishLexemeBundle<P>["LemmaSelectionSchema"],
		StandardPartialSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
			surfaceKind: "Partial",
		}) as unknown as EnglishLexemeBundle<P>["StandardPartialSelectionSchema"],
		StandardVariantSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
			surfaceKind: "Variant",
		}) as unknown as EnglishLexemeBundle<P>["StandardVariantSelectionSchema"],
		TypoInflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			language: "English",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as EnglishLexemeBundle<P>["TypoInflectionSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as EnglishLexemeBundle<P>["TypoLemmaSelectionSchema"],
		TypoPartialSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
			orthographicStatus: "Typo",
			surfaceKind: "Partial",
		}) as unknown as EnglishLexemeBundle<P>["TypoPartialSelectionSchema"],
		TypoVariantSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
			orthographicStatus: "Typo",
			surfaceKind: "Variant",
		}) as unknown as EnglishLexemeBundle<P>["TypoVariantSelectionSchema"],
	};
}
