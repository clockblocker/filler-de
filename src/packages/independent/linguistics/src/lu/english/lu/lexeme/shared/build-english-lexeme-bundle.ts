import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import type { Pos } from "../../../../universal/enums/kind/pos";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";
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
	StandardVariantSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Standard", "Variant", "Lexeme", P>
	>;
	TypoInflectionSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Typo", "Inflection", "Lexeme", P>
	>;
	TypoLemmaSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Typo", "Lemma", "Lexeme", P>
	>;
	TypoVariantSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Typo", "Variant", "Lexeme", P>
	>;
};

export function buildEnglishLexemeBundle<
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
}): EnglishLexemeBundle<P> {
	const lemmaIdentityShape = {
		lemmaKind: z.literal("Lexeme"),
		pos: z.literal(pos),
	} satisfies z.ZodRawShape;
	const lemmaSchema = z.object({
		meaningInEmojis: MeaningInEmojisSchema.optional(),
		inherentFeatures: inherentFeaturesSchema,
		lemmaKind: z.literal("Lexeme"),
		language: z.literal("English"),
		pos: z.literal(pos),
		canonicalLemma: z.string(),
	}) as unknown as EnglishLexemeBundle<P>["LemmaSchema"];

	return {
		InflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
		}) as unknown as EnglishLexemeBundle<P>["InflectionSelectionSchema"],
		LemmaSchema: lemmaSchema,
		LemmaSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
		}) as unknown as EnglishLexemeBundle<P>["LemmaSelectionSchema"],
		StandardVariantSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
			surfaceKind: "Variant",
		}) as unknown as EnglishLexemeBundle<P>["StandardVariantSelectionSchema"],
		TypoInflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as EnglishLexemeBundle<P>["TypoInflectionSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as EnglishLexemeBundle<P>["TypoLemmaSelectionSchema"],
		TypoVariantSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
			orthographicStatus: "Typo",
			surfaceKind: "Variant",
		}) as unknown as EnglishLexemeBundle<P>["TypoVariantSelectionSchema"],
	};
}
