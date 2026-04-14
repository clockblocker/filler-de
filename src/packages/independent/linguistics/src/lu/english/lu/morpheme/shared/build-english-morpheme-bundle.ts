import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import type { MorphemeKind } from "../../../../universal/enums/kind/morpheme-kind";
import { EmojiDescriptionSchema } from "../../../../universal/emoji-description";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";

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

	return {
		LemmaSchema: z
			.object({
				emojiDescription: EmojiDescriptionSchema.optional(),
				isClosedSet: z.boolean().optional(),
				lemmaKind: z.literal("Morpheme"),
				language: z.literal("English"),
				morphemeKind: z.literal(morphemeKind),
				spelledLemma: z.string(),
			})
			.strict() as unknown as EnglishMorphemeBundle<MK>["LemmaSchema"],
		StandardLemmaSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaIdentityShape,
		}) as unknown as EnglishMorphemeBundle<MK>["StandardLemmaSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as EnglishMorphemeBundle<MK>["TypoLemmaSelectionSchema"],
	};
}
