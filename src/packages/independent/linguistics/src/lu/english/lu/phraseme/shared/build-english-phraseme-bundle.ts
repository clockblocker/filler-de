import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { DiscourseFormulaRoleSchema } from "../../../../universal/enums/feature/custom/discourse-formula-role";
import type { PhrasemeKind } from "../../../../universal/enums/kind/phraseme-kind";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import { withLingIdLemmaDtoCompatibility } from "../../../../universal/ling-id-schema-compat";

type EnglishPhrasemeBundle<PK extends PhrasemeKind> = {
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
					discourseFormulaRole: DiscourseFormulaRoleSchema.optional(),
					meaningInEmojis: MeaningInEmojisSchema.optional(),
					lemmaKind: z.literal("Phraseme"),
					language: z.literal("English"),
					phrasemeKind: z.literal(phrasemeKind),
					canonicalLemma: z.string(),
				})
				.strict(),
		) as unknown as z.ZodType<AbstractLemma<"Phraseme", PK>>;
	}

	return withLingIdLemmaDtoCompatibility(
		z
			.object({
				meaningInEmojis: MeaningInEmojisSchema.optional(),
				lemmaKind: z.literal("Phraseme"),
				language: z.literal("English"),
				phrasemeKind: z.literal(phrasemeKind),
				canonicalLemma: z.string(),
			})
			.strict(),
	) as unknown as z.ZodType<AbstractLemma<"Phraseme", PK>>;
}

export function buildEnglishPhrasemeBundle<PK extends PhrasemeKind>({
	phrasemeKind,
}: {
	phrasemeKind: PK;
}): EnglishPhrasemeBundle<PK> {
	const lemmaIdentityShape = {
		lemmaKind: z.literal("Phraseme"),
		phrasemeKind: z.literal(phrasemeKind),
	} satisfies z.ZodRawShape;
	const lemmaSchema = buildPhrasemeLemmaSchema(phrasemeKind);

	return {
		LemmaSchema: lemmaSchema,
		StandardLemmaSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
		}) as unknown as EnglishPhrasemeBundle<PK>["StandardLemmaSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaSchema,
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as EnglishPhrasemeBundle<PK>["TypoLemmaSelectionSchema"],
	};
}
