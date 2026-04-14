import z from "zod/v3";
import type { AbstractLemma } from "../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../universal/abstract-selection";
import { DiscourseFormulaRoleSchema } from "../../../../universal/enums/feature/custom/discourse-formula-role";
import type { PhrasemeKind } from "../../../../universal/enums/kind/phraseme-kind";
import { EmojiDescriptionSchema } from "../../../../universal/emoji-description";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";

type GermanPhrasemeBundle<PK extends PhrasemeKind> = {
	LemmaSchema: z.ZodType<AbstractLemma<"Phraseme", PK>>;
	StandardLemmaSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Standard", "Lemma", "Phraseme", PK>
	>;
	StandardPartialSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Standard", "Partial", "Phraseme", PK>
	>;
	TypoLemmaSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Typo", "Lemma", "Phraseme", PK>
	>;
	TypoPartialSelectionSchema: z.ZodType<
		AbstractSelectionFor<"Typo", "Partial", "Phraseme", PK>
	>;
};

function buildPhrasemeLemmaSchema<PK extends PhrasemeKind>(phrasemeKind: PK) {
	if (phrasemeKind === "DiscourseFormula") {
		return z
			.object({
				discourseFormulaRole: DiscourseFormulaRoleSchema.optional(),
				emojiDescription: EmojiDescriptionSchema.optional(),
				lemmaKind: z.literal("Phraseme"),
				language: z.literal("German"),
				phrasemeKind: z.literal(phrasemeKind),
				spelledLemma: z.string(),
			})
			.strict() as unknown as z.ZodType<AbstractLemma<"Phraseme", PK>>;
	}

	return z
		.object({
			emojiDescription: EmojiDescriptionSchema.optional(),
			lemmaKind: z.literal("Phraseme"),
			language: z.literal("German"),
			phrasemeKind: z.literal(phrasemeKind),
			spelledLemma: z.string(),
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
			language: "German",
			lemmaIdentityShape,
		}) as unknown as GermanPhrasemeBundle<PK>["StandardLemmaSelectionSchema"],
		StandardPartialSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaIdentityShape,
			surfaceKind: "Partial",
		}) as unknown as GermanPhrasemeBundle<PK>["StandardPartialSelectionSchema"],
		TypoLemmaSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}) as unknown as GermanPhrasemeBundle<PK>["TypoLemmaSelectionSchema"],
		TypoPartialSelectionSchema: buildLemmaSelection({
			language: "German",
			lemmaIdentityShape,
			orthographicStatus: "Typo",
			surfaceKind: "Partial",
		}) as unknown as GermanPhrasemeBundle<PK>["TypoPartialSelectionSchema"],
	};
}
