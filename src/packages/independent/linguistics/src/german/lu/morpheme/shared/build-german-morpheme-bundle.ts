import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import type { MorphemeKind } from "../../../../universal/enums/kind/morpheme-kind";
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
				isClosedSet: z.boolean().optional(),
				lexicalRelations: AbstractLexicalRelationsSchema,
				morphemeKind: z.literal(morphemeKind),
			})
			.strict() as unknown as GermanMorphemeBundle<MK>["LemmaSchema"],
		StandardLemmaSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
		}) as unknown as GermanMorphemeBundle<MK>["StandardLemmaSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as GermanMorphemeBundle<MK>["TypoLemmaSelectionSchema"],
	};
}
