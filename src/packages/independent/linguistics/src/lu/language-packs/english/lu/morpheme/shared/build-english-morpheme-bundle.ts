import z from "zod/v3";
import type { MorphemeKind } from "../../../../../universal/enums/kind/morpheme-kind";
import { buildLemmaSelection } from "../../../../../universal/factories/buildLemmaSelection";
import { defineLemmaSchemaDescriptor } from "../../../../../universal/factories/lemma-schema-descriptor";
import { MeaningInEmojisSchema } from "../../../../../universal/meaning-in-emojis";

export function buildEnglishMorphemeBundle<MK extends MorphemeKind>({
	morphemeKind,
}: {
	morphemeKind: MK;
}) {
	const lemmaIdentityShape = {
		lemmaKind: z.literal("Morpheme"),
		morphemeKind: z.literal(morphemeKind),
	} satisfies z.ZodRawShape;

	const lemma = defineLemmaSchemaDescriptor({
		language: "English",
		schema: z
			.object({
				canonicalLemma: z.string(),
				isClosedSet: z.boolean().optional(),
				language: z.literal("English"),
				lemmaKind: z.literal("Morpheme"),
				meaningInEmojis: MeaningInEmojisSchema,
				morphemeKind: z.literal(morphemeKind),
			})
			.strict(),
	});

	return {
		LemmaSchema: lemma.schema,
		StandardLemmaSelectionSchema: buildLemmaSelection({
			lemma,
			lemmaIdentityShape,
		}),
		TypoLemmaSelectionSchema: buildLemmaSelection({
			lemma,
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}),
	};
}
