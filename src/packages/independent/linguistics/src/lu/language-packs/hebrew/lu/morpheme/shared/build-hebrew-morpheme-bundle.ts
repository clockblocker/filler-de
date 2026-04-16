import z from "zod/v3";
import type { MorphemeKind } from "../../../../../universal/enums/kind/morpheme-kind";
import { buildLemmaSelection } from "../../../../../universal/factories/buildLemmaSelection";
import { withLingIdLemmaDtoCompatibility } from "../../../../../universal/ling-id-schema-compat";
import { MeaningInEmojisSchema } from "../../../../../universal/meaning-in-emojis";

export function buildHebrewMorphemeBundle<MK extends MorphemeKind>({
	morphemeKind,
}: {
	morphemeKind: MK;
}) {
	const lemmaIdentityShape = {
		lemmaKind: z.literal("Morpheme"),
		morphemeKind: z.literal(morphemeKind),
	} satisfies z.ZodRawShape;

	const lemmaSchema = withLingIdLemmaDtoCompatibility(
		z
			.object({
				canonicalLemma: z.string(),
				isClosedSet: z.boolean().optional(),
				language: z.literal("Hebrew"),
				lemmaKind: z.literal("Morpheme"),
				meaningInEmojis: MeaningInEmojisSchema,
				morphemeKind: z.literal(morphemeKind),
			})
			.strict(),
	);

	return {
		LemmaSchema: lemmaSchema,
		StandardLemmaSelectionSchema: buildLemmaSelection({
			language: "Hebrew",
			lemmaIdentityShape,
			lemmaSchema,
		}),
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "Hebrew",
			lemmaIdentityShape,
			lemmaSchema,
			orthographicStatus: "Typo",
		}),
	};
}
