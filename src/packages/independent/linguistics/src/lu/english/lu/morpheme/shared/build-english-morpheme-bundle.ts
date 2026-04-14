import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import type { MorphemeKind } from "../../../../universal/enums/kind/morpheme-kind";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import { withLingIdLemmaDtoCompatibility } from "../../../../universal/ling-id-schema-compat";

type EnglishMorphemeBundle<MK extends MorphemeKind> = {
	LemmaSchema: z.ZodType<AbstractLemma<"Morpheme", MK>>;
	StandardLemmaSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Standard", "Lemma", "Morpheme", MK>
	>;
	TypoLemmaSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Typo", "Lemma", "Morpheme", MK>
	>;
};

export function buildEnglishMorphemeBundle<MK extends MorphemeKind>({
	morphemeKind,
}: {
	morphemeKind: MK;
}): EnglishMorphemeBundle<MK> {
	const lemmaIdentityShape = {
		lemmaKind: z.literal("Morpheme"),
		morphemeKind: z.literal(morphemeKind),
	} satisfies z.ZodRawShape;
	const lemmaSchema = withLingIdLemmaDtoCompatibility(
		z
			.object({
				meaningInEmojis: MeaningInEmojisSchema.optional(),
				isClosedSet: z.boolean().optional(),
				lemmaKind: z.literal("Morpheme"),
				language: z.literal("English"),
				morphemeKind: z.literal(morphemeKind),
				canonicalLemma: z.string(),
			})
			.strict(),
	) as unknown as EnglishMorphemeBundle<MK>["LemmaSchema"];

	return {
		LemmaSchema: lemmaSchema,
		StandardLemmaSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
		}) as unknown as EnglishMorphemeBundle<MK>["StandardLemmaSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as EnglishMorphemeBundle<MK>["TypoLemmaSelectionSchema"],
	};
}
