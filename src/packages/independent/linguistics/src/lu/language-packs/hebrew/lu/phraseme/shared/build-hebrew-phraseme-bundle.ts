import z from "zod/v3";
import { UniversalFeature } from "../../../../../universal/enums/feature";
import type { PhrasemeKind } from "../../../../../universal/enums/kind/phraseme-kind";
import { buildLemmaSelection } from "../../../../../universal/factories/buildLemmaSelection";
import { defineLemmaSchemaDescriptor } from "../../../../../universal/factories/lemma-schema-descriptor";
import { MeaningInEmojisSchema } from "../../../../../universal/meaning-in-emojis";

function buildPhrasemeLemmaDescriptor<PK extends PhrasemeKind>(
	phrasemeKind: PK,
) {
	if (phrasemeKind === "DiscourseFormula") {
		return defineLemmaSchemaDescriptor({
			language: "Hebrew",
			schema: z
				.object({
					canonicalLemma: z.string(),
					discourseFormulaRole:
						UniversalFeature.DiscourseFormulaRole.optional(),
					language: z.literal("Hebrew"),
					lemmaKind: z.literal("Phraseme"),
					meaningInEmojis: MeaningInEmojisSchema,
					phrasemeKind: z.literal(phrasemeKind),
				})
				.strict(),
		});
	}

	return defineLemmaSchemaDescriptor({
		language: "Hebrew",
		schema: z
			.object({
				canonicalLemma: z.string(),
				language: z.literal("Hebrew"),
				lemmaKind: z.literal("Phraseme"),
				meaningInEmojis: MeaningInEmojisSchema,
				phrasemeKind: z.literal(phrasemeKind),
			})
			.strict(),
	});
}

export function buildHebrewPhrasemeBundle<PK extends PhrasemeKind>({
	phrasemeKind,
}: {
	phrasemeKind: PK;
}) {
	const lemmaIdentityShape = {
		lemmaKind: z.literal("Phraseme"),
		phrasemeKind: z.literal(phrasemeKind),
	} satisfies z.ZodRawShape;
	const lemma = buildPhrasemeLemmaDescriptor(phrasemeKind);

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
