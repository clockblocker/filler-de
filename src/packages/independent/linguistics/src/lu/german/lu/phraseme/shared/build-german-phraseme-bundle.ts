import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { DiscourseFormulaRoleSchema } from "../../../../universal/enums/feature/custom/discourse-formula-role";
import type { PhrasemeKind } from "../../../../universal/enums/kind/phraseme-kind";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import { withLingIdLemmaDtoCompatibility } from "../../../../universal/ling-id-schema-compat";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";

type GermanPhrasemeBundle<PK extends PhrasemeKind> = {
	LemmaSchema: z.ZodType<AbstractLemma<"Phraseme", PK>>;
	StandardLemmaSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Standard", "Lemma", "Phraseme", PK>
	>;
	TypoLemmaSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Typo", "Lemma", "Phraseme", PK>
	>;
};

function buildPhrasemeLemmaSchema<PK extends PhrasemeKind>(phrasemeKind: PK) {
	if (phrasemeKind === "DiscourseFormula") {
		return withLingIdLemmaDtoCompatibility(
			z
				.object({
					canonicalLemma: z.string(),
					discourseFormulaRole: DiscourseFormulaRoleSchema.optional(),
					language: z.literal("German"),
					lemmaKind: z.literal("Phraseme"),
					meaningInEmojis: MeaningInEmojisSchema,
					phrasemeKind: z.literal(phrasemeKind),
				})
				.strict(),
		) as unknown as z.ZodType<AbstractLemma<"Phraseme", PK>>;
	}

	return withLingIdLemmaDtoCompatibility(
		z
			.object({
				canonicalLemma: z.string(),
				language: z.literal("German"),
				lemmaKind: z.literal("Phraseme"),
				meaningInEmojis: MeaningInEmojisSchema,
				phrasemeKind: z.literal(phrasemeKind),
			})
			.strict(),
	) as unknown as z.ZodType<AbstractLemma<"Phraseme", PK>>;
}

export function buildGermanPhrasemeBundle<PK extends PhrasemeKind>({
	phrasemeKind,
}: {
	phrasemeKind: PK;
}): GermanPhrasemeBundle<PK> {
	const lemmaIdentityShape = {
		lemmaKind: z.literal("Phraseme"),
		phrasemeKind: z.literal(phrasemeKind),
	} satisfies z.ZodRawShape;
	const lemmaSchema = buildPhrasemeLemmaSchema(phrasemeKind);

	return {
		LemmaSchema: lemmaSchema,
		StandardLemmaSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaIdentityShape,
			lemmaSchema,
		}) as unknown as GermanPhrasemeBundle<PK>["StandardLemmaSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaIdentityShape,
			lemmaSchema,
			orthographicStatus: "Typo",
		}) as unknown as GermanPhrasemeBundle<PK>["TypoLemmaSelectionSchema"],
	};
}
