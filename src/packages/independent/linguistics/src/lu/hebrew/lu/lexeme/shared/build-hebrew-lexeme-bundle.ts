import z from "zod/v3";
import type { Pos } from "../../../../universal/enums/kind/pos";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import { withLingIdLemmaDtoCompatibility } from "../../../../universal/ling-id-schema-compat";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";

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

	const lemmaSchema = withLingIdLemmaDtoCompatibility(
		z.object({
			canonicalLemma: z.string(),
			inherentFeatures: inherentFeaturesSchema,
			language: z.literal("Hebrew"),
			lemmaKind: z.literal("Lexeme"),
			meaningInEmojis: MeaningInEmojisSchema,
			pos: z.literal(pos),
		}),
	);

	return {
		InflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			language: "Hebrew",
			lemmaIdentityShape,
			lemmaSchema,
		}),
		LemmaSchema: lemmaSchema,
		LemmaSelectionSchema: buildLemmaSelection({
			language: "Hebrew",
			lemmaIdentityShape,
			lemmaSchema,
		}),
		StandardVariantSelectionSchema: buildLemmaSelection({
			language: "Hebrew",
			lemmaIdentityShape,
			lemmaSchema,
			surfaceKind: "Variant",
		}),
		TypoInflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			language: "Hebrew",
			lemmaIdentityShape,
			lemmaSchema,
			orthographicStatus: "Typo",
		}),
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "Hebrew",
			lemmaIdentityShape,
			lemmaSchema,
			orthographicStatus: "Typo",
		}),
		TypoVariantSelectionSchema: buildLemmaSelection({
			language: "Hebrew",
			lemmaIdentityShape,
			lemmaSchema,
			orthographicStatus: "Typo",
			surfaceKind: "Variant",
		}),
	};
}
