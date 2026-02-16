import { z } from "zod/v3";
import { GermanGenusSchema, NounClassSchema } from "../lexem/noun/features";
import {
	GermanVerbConjugationSchema,
	GermanVerbValencySchema,
} from "../lexem/verb/features";
import type { DeLemmaResult } from "./de-lemma-result";
import {
	DeLexemLemmaResultSchema,
	DeLexemPosSchema,
	DePhrasemLemmaResultSchema,
} from "./de-lemma-result";

const buildContextualInputSchema = <T extends z.ZodTypeAny>(target: T) =>
	z.object({
		context: z.string(),
		target,
	});

export const DeLexemTargetSchema = DeLexemLemmaResultSchema.omit({
	contextWithLinkedParts: true,
});
export type DeLexemTarget = z.infer<typeof DeLexemTargetSchema>;

export const DePhrasemTargetSchema = DePhrasemLemmaResultSchema.omit({
	contextWithLinkedParts: true,
});
export type DePhrasemTarget = z.infer<typeof DePhrasemTargetSchema>;

export const DeLexicalTargetSchema = z.discriminatedUnion("linguisticUnit", [
	DeLexemTargetSchema,
	DePhrasemTargetSchema,
]);
export type DeLexicalTarget = z.infer<typeof DeLexicalTargetSchema>;

export function toDeLexicalTarget(result: DeLemmaResult): DeLexicalTarget {
	if (result.linguisticUnit === "Lexem") {
		return {
			lemma: result.lemma,
			linguisticUnit: "Lexem",
			posLikeKind: result.posLikeKind,
			surfaceKind: result.surfaceKind,
		};
	}

	return {
		lemma: result.lemma,
		linguisticUnit: "Phrasem",
		posLikeKind: result.posLikeKind,
		surfaceKind: result.surfaceKind,
	};
}

export function isDeLexemTarget(
	target: DeLexicalTarget,
): target is DeLexemTarget {
	return target.linguisticUnit === "Lexem";
}

export function isDePhrasemTarget(
	target: DeLexicalTarget,
): target is DePhrasemTarget {
	return target.linguisticUnit === "Phrasem";
}

export const DeEnrichmentInputSchema = buildContextualInputSchema(
	DeLexicalTargetSchema,
);
export type DeEnrichmentInput = z.infer<typeof DeEnrichmentInputSchema>;

const emojiDescriptionSchema = z.array(z.string().min(1).max(4)).min(1).max(3);

const deEnrichmentOutputBaseSchema = z
	.object({
		emojiDescription: emojiDescriptionSchema,
		ipa: z.string().min(1),
	})
	.strict();

export const DeLexemEnrichmentOutputSchema = z.discriminatedUnion(
	"posLikeKind",
	[
		deEnrichmentOutputBaseSchema.extend({
			genus: GermanGenusSchema.nullable().optional(),
			linguisticUnit: z.literal("Lexem"),
			nounClass: NounClassSchema.nullable().optional(),
			posLikeKind: z.literal("Noun"),
		}),
		...DeLexemPosSchema.options
			.filter((pos) => pos !== "Noun")
			.map((pos) =>
				deEnrichmentOutputBaseSchema.extend({
					linguisticUnit: z.literal("Lexem"),
					posLikeKind: z.literal(pos),
				}),
			),
	],
);

export const DePhrasemEnrichmentOutputSchema =
	deEnrichmentOutputBaseSchema.extend({
		linguisticUnit: z.literal("Phrasem"),
		posLikeKind: DePhrasemTargetSchema.shape.posLikeKind,
	});

export const DeEnrichmentOutputSchema = z.union([
	DeLexemEnrichmentOutputSchema,
	DePhrasemEnrichmentOutputSchema,
]);

export type DeEnrichmentOutput = z.infer<typeof DeEnrichmentOutputSchema>;

export const DeRelationInputSchema = buildContextualInputSchema(
	DeLexicalTargetSchema,
);
export type DeRelationInput = z.infer<typeof DeRelationInputSchema>;

const relationSubKinds = [
	"Synonym",
	"NearSynonym",
	"Antonym",
	"Hypernym",
	"Hyponym",
	"Meronym",
	"Holonym",
] as const;

export const DeRelationSubKindSchema = z.enum(relationSubKinds);
export type DeRelationSubKind = z.infer<typeof DeRelationSubKindSchema>;

export const DeRelationOutputSchema = z.object({
	relations: z.array(
		z.object({
			kind: DeRelationSubKindSchema,
			words: z.array(z.string()),
		}),
	),
});
export type DeRelationOutput = z.infer<typeof DeRelationOutputSchema>;

export const DeInflectionInputSchema =
	buildContextualInputSchema(DeLexemTargetSchema);
export type DeInflectionInput = z.infer<typeof DeInflectionInputSchema>;

export const DeInflectionOutputSchema = z.object({
	rows: z.array(
		z.object({
			forms: z.string().min(1),
			label: z.string().min(1).max(60),
		}),
	),
});
export type DeInflectionOutput = z.infer<typeof DeInflectionOutputSchema>;

export const DeFeaturesInputSchema =
	buildContextualInputSchema(DeLexemTargetSchema);
export type DeFeaturesInput = z.infer<typeof DeFeaturesInputSchema>;

const deFeatureTagOutputSchema = z.object({
	tags: z.array(z.string().min(1).max(30)).min(1).max(5),
});
const deVerbFeatureOutputSchema = z
	.object({
		conjugation: GermanVerbConjugationSchema,
		valency: GermanVerbValencySchema,
	})
	.strict();

export const DeFeaturesOutputSchema = z.union([
	deFeatureTagOutputSchema,
	deVerbFeatureOutputSchema,
]);
export type DeFeaturesOutput = z.infer<typeof DeFeaturesOutputSchema>;

export const DeWordTranslationInputSchema = buildContextualInputSchema(
	DeLexicalTargetSchema,
);
export type DeWordTranslationInput = z.infer<
	typeof DeWordTranslationInputSchema
>;

export const DeWordTranslationOutputSchema = z
	.string()
	.describe("Translated word or phrase");
export type DeWordTranslationOutput = z.infer<
	typeof DeWordTranslationOutputSchema
>;
