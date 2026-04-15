import z from "zod/v3";
import type { Pos } from "../../../../universal/enums/kind/pos";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import { withLingIdLemmaDtoCompatibility } from "../../../../universal/ling-id-schema-compat";

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
}) {
	const lemmaIdentityShape = {
		lemmaKind: z.literal("Lexeme"),
		pos: z.literal(pos),
	} satisfies z.ZodRawShape;
	const lemmaSchema = withLingIdLemmaDtoCompatibility(
		z.object({
			meaningInEmojis: MeaningInEmojisSchema,
			inherentFeatures: inherentFeaturesSchema,
			lemmaKind: z.literal("Lexeme"),
			language: z.literal("English"),
			pos: z.literal(pos),
			canonicalLemma: z.string(),
		}),
	);

	return {
		InflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
		}),
		LemmaSchema: lemmaSchema,
		LemmaSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
		}),
		StandardVariantSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
			surfaceKind: "Variant",
		}),
		TypoInflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}),
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}),
		TypoVariantSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
			orthographicStatus: "Typo",
			surfaceKind: "Variant",
		}),
	};
}
