import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import type { Pos } from "../../../../universal/enums/kind/pos";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";

export function buildGermanLexemeBundle<
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
}) {
	const lemmaIdentityShape = {
		lemmaKind: z.literal("Lexeme"),
		pos: z.literal(pos),
	} satisfies z.ZodRawShape;

	return {
		InflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			lemmaIdentityShape,
		}) satisfies z.ZodType<
			AbstractSelectionFor<"Standard", "Inflection", "Lexeme", P>
		>,
		LemmaSchema: z.object({
			inherentFeatures: inherentFeaturesSchema,
			lexicalRelations: lexicalRelationsSchema,
			morphologicalRelations: morphologicalRelationsSchema,
			pos: z.literal(pos),
		}) satisfies z.ZodType<AbstractLemma<"Lexeme", P>>,
		LemmaSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
		}) satisfies z.ZodType<
			AbstractSelectionFor<"Standard", "Lemma", "Lexeme", P>
		>,
		StandardPartialSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
			surfaceKind: "Partial",
		}) satisfies z.ZodType<
			AbstractSelectionFor<"Standard", "Partial", "Lexeme", P>
		>,
		StandardVariantSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
			surfaceKind: "Variant",
		}) satisfies z.ZodType<
			AbstractSelectionFor<"Standard", "Variant", "Lexeme", P>
		>,
		TypoInflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) satisfies z.ZodType<
			AbstractSelectionFor<"Typo", "Inflection", "Lexeme", P>
		>,
		TypoLemmaSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) satisfies z.ZodType<
			AbstractSelectionFor<"Typo", "Lemma", "Lexeme", P>
		>,
		TypoPartialSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
			orthographicStatus: "Typo",
			surfaceKind: "Partial",
		}) satisfies z.ZodType<
			AbstractSelectionFor<"Typo", "Partial", "Lexeme", P>
		>,
		TypoVariantSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
			orthographicStatus: "Typo",
			surfaceKind: "Variant",
		}) satisfies z.ZodType<
			AbstractSelectionFor<"Typo", "Variant", "Lexeme", P>
		>,
	};
}
