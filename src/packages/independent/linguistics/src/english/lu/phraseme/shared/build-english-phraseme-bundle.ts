import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { DiscourseFormulaRoleSchema } from "../../../../universal/enums/feature/custom/discourse-formula-role";
import type { PhrasemeKind } from "../../../../universal/enums/kind/phraseme-kind";
import { EmojiDescriptionSchema } from "../../../../universal/emoji-description";
import { AbstractLexicalRelationsSchema } from "../../../../universal/enums/relation/relation";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";

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
		return z
			.object({
				discourseFormulaRole: DiscourseFormulaRoleSchema.optional(),
				emojiDescription: EmojiDescriptionSchema.optional(),
				lexicalRelations: AbstractLexicalRelationsSchema,
				phrasemeKind: z.literal(phrasemeKind),
			})
			.strict() as unknown as z.ZodType<AbstractLemma<"Phraseme", PK>>;
	}

	return z
		.object({
			emojiDescription: EmojiDescriptionSchema.optional(),
			lexicalRelations: AbstractLexicalRelationsSchema,
			phrasemeKind: z.literal(phrasemeKind),
		})
		.strict() as unknown as z.ZodType<AbstractLemma<"Phraseme", PK>>;
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

	return {
		LemmaSchema: buildPhrasemeLemmaSchema(phrasemeKind),
		StandardLemmaSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
		}) as unknown as EnglishPhrasemeBundle<PK>["StandardLemmaSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as EnglishPhrasemeBundle<PK>["TypoLemmaSelectionSchema"],
	};
}
