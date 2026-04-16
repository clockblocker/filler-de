import z from "zod/v3";
import type { Pos } from "../../../../../universal/enums/kind/pos";
import { buildInflectionSelection } from "../../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../../universal/factories/buildLemmaSelection";
import { defineLemmaSchemaDescriptor } from "../../../../../universal/factories/lemma-schema-descriptor";
import { MeaningInEmojisSchema } from "../../../../../universal/meaning-in-emojis";

export function buildHebrewLexemeBundle<
	P extends Pos,
	InflectionalFeaturesSchema extends z.ZodTypeAny,
	InherentFeaturesSchema extends z.ZodTypeAny,
>({
	inflectionalFeaturesSchema,
	inherentFeaturesSchema,
	pos,
}: {
	inflectionalFeaturesSchema: InflectionalFeaturesSchema;
	inherentFeaturesSchema: InherentFeaturesSchema;
	pos: P;
}) {
	const lemmaIdentityShape = {
		lemmaKind: z.literal("Lexeme"),
		pos: z.literal(pos),
	} satisfies z.ZodRawShape;

	const lemma = defineLemmaSchemaDescriptor({
		language: "Hebrew",
		schema: z
			.object({
				canonicalLemma: z.string(),
				inherentFeatures: inherentFeaturesSchema,
				language: z.literal("Hebrew"),
				lemmaKind: z.literal("Lexeme"),
				meaningInEmojis: MeaningInEmojisSchema,
				pos: z.literal(pos),
			})
			.strict(),
	});

	return {
		InflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			lemma,
			lemmaIdentityShape,
		}),
		LemmaSchema: lemma.schema,
		LemmaSelectionSchema: buildLemmaSelection({
			lemma,
			lemmaIdentityShape,
		}),
		TypoInflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			lemma,
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}),
		TypoLemmaSelectionSchema: buildLemmaSelection({
			lemma,
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}),
	};
}
