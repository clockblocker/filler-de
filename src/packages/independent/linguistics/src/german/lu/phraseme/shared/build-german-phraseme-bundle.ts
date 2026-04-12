import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { DiscourseFormulaRoleSchema } from "../../../../universal/enums/feature/custom/discourse-formula-role";
import type { PhrasemeKind } from "../../../../universal/enums/kind/phraseme-kind";
import { AbstractLexicalRelationsSchema } from "../../../../universal/enums/relation/relation";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";

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
		return z
			.object({
				discourseFormulaRole: DiscourseFormulaRoleSchema.optional(),
				lexicalRelations: AbstractLexicalRelationsSchema,
				phrasemeKind: z.literal(phrasemeKind),
			})
			.strict() as unknown as z.ZodType<AbstractLemma<"Phraseme", PK>>;
	}

	return z
		.object({
			lexicalRelations: AbstractLexicalRelationsSchema,
			phrasemeKind: z.literal(phrasemeKind),
		})
		.strict() as unknown as z.ZodType<AbstractLemma<"Phraseme", PK>>;
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

	return {
		LemmaSchema: buildPhrasemeLemmaSchema(phrasemeKind),
		StandardLemmaSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
		}) as unknown as GermanPhrasemeBundle<PK>["StandardLemmaSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as GermanPhrasemeBundle<PK>["TypoLemmaSelectionSchema"],
	};
}
