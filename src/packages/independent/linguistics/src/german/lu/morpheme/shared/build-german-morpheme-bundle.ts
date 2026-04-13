import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { IsSeparable } from "../../../../universal/enums/feature/custom/separable";
import type { MorphemeKind } from "../../../../universal/enums/kind/morpheme-kind";
import { EmojiDescriptionSchema } from "../../../../universal/emoji-description";
import { AbstractLexicalRelationsSchema } from "../../../../universal/enums/relation/relation";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";

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

	return {
		LemmaSchema: z
			.object({
				emojiDescription: EmojiDescriptionSchema.optional(),
				isClosedSet: z.boolean().optional(),
				lemmaKind: z.literal("Morpheme"),
				language: z.literal("German"),
				lexicalRelations: AbstractLexicalRelationsSchema,
				morphemeKind: z.literal(morphemeKind),
				separable:
					morphemeKind === "Prefix" ? IsSeparable.optional() : z.undefined().optional(),
				spelledLemma: z.string(),
			})
			.strict() as unknown as GermanMorphemeBundle<MK>["LemmaSchema"],
		StandardLemmaSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaExtraShape:
				morphemeKind === "Prefix"
					? {
							separable: IsSeparable.optional(),
						}
					: {},
			lemmaIdentityShape,
		}) as unknown as GermanMorphemeBundle<MK>["StandardLemmaSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaExtraShape:
				morphemeKind === "Prefix"
					? {
							separable: IsSeparable.optional(),
						}
					: {},
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as GermanMorphemeBundle<MK>["TypoLemmaSelectionSchema"],
	};
}
