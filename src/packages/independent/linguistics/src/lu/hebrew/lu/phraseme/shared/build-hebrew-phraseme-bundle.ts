import z from "zod/v3";
import { UniversalFeature } from "../../../../universal/enums/feature";
import type { PhrasemeKind } from "../../../../universal/enums/kind/phraseme-kind";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import { withLingIdLemmaDtoCompatibility } from "../../../../universal/ling-id-schema-compat";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";

function buildPhrasemeLemmaSchema<PK extends PhrasemeKind>(phrasemeKind: PK) {
	if (phrasemeKind === "DiscourseFormula") {
		return withLingIdLemmaDtoCompatibility(
			z
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
		);
	}

	return withLingIdLemmaDtoCompatibility(
		z
			.object({
				canonicalLemma: z.string(),
				language: z.literal("Hebrew"),
				lemmaKind: z.literal("Phraseme"),
				meaningInEmojis: MeaningInEmojisSchema,
				phrasemeKind: z.literal(phrasemeKind),
			})
			.strict(),
	);
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
	const lemmaSchema = buildPhrasemeLemmaSchema(phrasemeKind);

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
