import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { DiscourseFormulaRoleSchema } from "../../../../universal/enums/feature/custom/discourse-formula-role";
import type { PhrasemeKind } from "../../../../universal/enums/kind/phraseme-kind";
import { EmojiDescriptionSchema } from "../../../../universal/emoji-description";
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
				lemmaKind: z.literal("Phraseme"),
				language: z.literal("English"),
				phrasemeKind: z.literal(phrasemeKind),
				spelledLemma: z.string(),
			})
			.strict() as unknown as z.ZodType<AbstractLemma<"Phraseme", PK>>;
	}

	return z
		.object({
			emojiDescription: EmojiDescriptionSchema.optional(),
			lemmaKind: z.literal("Phraseme"),
			language: z.literal("English"),
			phrasemeKind: z.literal(phrasemeKind),
			spelledLemma: z.string(),
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
			language: "English",
			lemmaIdentityShape,
		}) as unknown as EnglishPhrasemeBundle<PK>["StandardLemmaSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "English",
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as EnglishPhrasemeBundle<PK>["TypoLemmaSelectionSchema"],
	};
}
