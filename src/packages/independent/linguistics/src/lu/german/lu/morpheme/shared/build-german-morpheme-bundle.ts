import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { IsSeparable } from "../../../../universal/enums/feature/custom/separable";
import type { MorphemeKind } from "../../../../universal/enums/kind/morpheme-kind";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";

type GermanMorphemeBundle<MK extends MorphemeKind> = {
	LemmaSchema: z.ZodType<AbstractLemma<"Morpheme", MK>>;
	StandardLemmaSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Standard", "Lemma", "Morpheme", MK>
	>;
	TypoLemmaSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Typo", "Lemma", "Morpheme", MK>
	>;
};

export function buildGermanMorphemeBundle<MK extends MorphemeKind>({
	morphemeKind,
}: {
	morphemeKind: MK;
}): GermanMorphemeBundle<MK> {
	const lemmaIdentityShape = {
		lemmaKind: z.literal("Morpheme"),
		morphemeKind: z.literal(morphemeKind),
	} satisfies z.ZodRawShape;
	const lemmaSchema = z
		.object({
			canonicalLemma: z.string(),
			isClosedSet: z.boolean().optional(),
			language: z.literal("German"),
			lemmaKind: z.literal("Morpheme"),
			meaningInEmojis: MeaningInEmojisSchema.optional(),
			morphemeKind: z.literal(morphemeKind),
			separable:
				morphemeKind === "Prefix"
					? IsSeparable.optional()
					: z.undefined().optional(),
		})
		.strict() as unknown as GermanMorphemeBundle<MK>["LemmaSchema"];

	return {
		LemmaSchema: lemmaSchema,
		StandardLemmaSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaIdentityShape,
			lemmaSchema,
		}) as unknown as GermanMorphemeBundle<MK>["StandardLemmaSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaIdentityShape,
			lemmaSchema,
			orthographicStatus: "Typo",
		}) as unknown as GermanMorphemeBundle<MK>["TypoLemmaSelectionSchema"],
	};
}
