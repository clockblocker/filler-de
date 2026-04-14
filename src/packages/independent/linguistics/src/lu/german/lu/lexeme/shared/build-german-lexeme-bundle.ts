import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import type { Pos } from "../../../../universal/enums/kind/pos";
import { SenseEmojisSchema } from "../../../../universal/sense-emojis";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";

type GermanLexemeBundle<P extends Pos> = {
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

export function buildGermanLexemeBundle<
	P extends Pos,
	InflectionalFeaturesSchema extends z.ZodTypeAny,
	InherentFeaturesSchema extends z.ZodTypeAny,
>({
	inflectionalFeaturesSchema,
	inherentFeaturesSchema,
	lexicalRelationsSchema: _lexicalRelationsSchema,
	morphologicalRelationsSchema: _morphologicalRelationsSchema,
	pos,
}: {
	inflectionalFeaturesSchema: InflectionalFeaturesSchema;
	inherentFeaturesSchema: InherentFeaturesSchema;
	lexicalRelationsSchema: z.ZodTypeAny;
	morphologicalRelationsSchema: z.ZodTypeAny;
	pos: P;
}): GermanLexemeBundle<P> {
	const lemmaIdentityShape = {
		lemmaKind: z.literal("Lexeme"),
		pos: z.literal(pos),
	} satisfies z.ZodRawShape;

	return {
		InflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			language: "German",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
		}) as unknown as GermanLexemeBundle<P>["InflectionSelectionSchema"],
		LemmaSchema: z.object({
			senseEmojis: SenseEmojisSchema.optional(),
			inherentFeatures: inherentFeaturesSchema,
			lemmaKind: z.literal("Lexeme"),
			language: z.literal("German"),
			pos: z.literal(pos),
			spelledLemma: z.string(),
		}) as unknown as GermanLexemeBundle<P>["LemmaSchema"],
		LemmaSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
		}) as unknown as GermanLexemeBundle<P>["LemmaSelectionSchema"],
		StandardPartialSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
			surfaceKind: "Partial",
		}) as unknown as GermanLexemeBundle<P>["StandardPartialSelectionSchema"],
		StandardVariantSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
			surfaceKind: "Variant",
		}) as unknown as GermanLexemeBundle<P>["StandardVariantSelectionSchema"],
		TypoInflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			language: "German",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as GermanLexemeBundle<P>["TypoInflectionSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as GermanLexemeBundle<P>["TypoLemmaSelectionSchema"],
		TypoPartialSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
			orthographicStatus: "Typo",
			surfaceKind: "Partial",
		}) as unknown as GermanLexemeBundle<P>["TypoPartialSelectionSchema"],
		TypoVariantSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaExtraShape: {
				inherentFeatures: inherentFeaturesSchema.optional(),
			},
			lemmaIdentityShape,
			orthographicStatus: "Typo",
			surfaceKind: "Variant",
		}) as unknown as GermanLexemeBundle<P>["TypoVariantSelectionSchema"],
	};
}
