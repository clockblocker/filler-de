import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import type { Pos } from "../../../../universal/enums/kind/pos";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import { withLingIdLemmaDtoCompatibility } from "../../../../universal/ling-id-schema-compat";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";

type GermanLexemeBundle<P extends Pos> = {
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
	const lemmaSchema = withLingIdLemmaDtoCompatibility(
		z.object({
			inherentFeatures: inherentFeaturesSchema,
			language: z.literal("German"),
			lemmaKind: z.literal("Lexeme"),
			meaningInEmojis: MeaningInEmojisSchema.optional(),
			pos: z.literal(pos),
			canonicalLemma: z.string(),
		}),
	) as unknown as GermanLexemeBundle<P>["LemmaSchema"];

	return {
		InflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			language: "German",
			lemmaIdentityShape,
			lemmaSchema,
		}) as unknown as GermanLexemeBundle<P>["InflectionSelectionSchema"],
		LemmaSchema: lemmaSchema,
		LemmaSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaIdentityShape,
			lemmaSchema,
		}) as unknown as GermanLexemeBundle<P>["LemmaSelectionSchema"],
		StandardVariantSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaIdentityShape,
			lemmaSchema,
			surfaceKind: "Variant",
		}) as unknown as GermanLexemeBundle<P>["StandardVariantSelectionSchema"],
		TypoInflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			language: "German",
			lemmaIdentityShape,
			lemmaSchema,
			orthographicStatus: "Typo",
		}) as unknown as GermanLexemeBundle<P>["TypoInflectionSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaIdentityShape,
			lemmaSchema,
			orthographicStatus: "Typo",
		}) as unknown as GermanLexemeBundle<P>["TypoLemmaSelectionSchema"],
		TypoVariantSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaIdentityShape,
			lemmaSchema,
			orthographicStatus: "Typo",
			surfaceKind: "Variant",
		}) as unknown as GermanLexemeBundle<P>["TypoVariantSelectionSchema"],
	};
}
