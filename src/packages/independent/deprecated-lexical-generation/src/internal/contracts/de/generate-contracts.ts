import { z } from "zod/v3";
import {
	LexicalGenusSchema,
	LexicalNounClassSchema,
	LexicalVerbConjugationSchema,
	LexicalVerbValencySchema,
} from "../../schema-primitives";
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

const DeLexemTargetSchema = DeLexemLemmaResultSchema.omit({
	contextWithLinkedParts: true,
});

const DePhrasemTargetSchema = DePhrasemLemmaResultSchema.omit({
	contextWithLinkedParts: true,
});

export const DeLexicalTargetSchema = z.discriminatedUnion("linguisticUnit", [
	DeLexemTargetSchema,
	DePhrasemTargetSchema,
]);




export const DeEnrichmentInputSchema = buildContextualInputSchema(
	DeLexicalTargetSchema,
);

const senseEmojisSchema = z.array(z.string().min(1).max(4)).min(1).max(3);
const senseGlossSchema = z.string().min(3).max(120);

const deEnrichmentOutputBaseSchema = z
	.object({
		senseEmojis: senseEmojisSchema,
		ipa: z.string().min(1),
		senseGloss: senseGlossSchema.nullable().optional(),
	})
	.strict();

const DeLexemEnrichmentOutputSchema = z.discriminatedUnion("posLikeKind", [
	deEnrichmentOutputBaseSchema.extend({
		genus: LexicalGenusSchema.nullable().optional(),
		linguisticUnit: z.literal("Lexem"),
		nounClass: LexicalNounClassSchema.nullable().optional(),
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
]);

const DePhrasemEnrichmentOutputSchema = deEnrichmentOutputBaseSchema.extend({
	linguisticUnit: z.literal("Phrasem"),
	posLikeKind: DePhrasemTargetSchema.shape.posLikeKind,
});

export const DeEnrichmentOutputSchema = z.union([
	DeLexemEnrichmentOutputSchema,
	DePhrasemEnrichmentOutputSchema,
]);


export const DeRelationInputSchema = buildContextualInputSchema(
	DeLexicalTargetSchema,
);

const relationSubKinds = [
	"Synonym",
	"NearSynonym",
	"Antonym",
	"Hypernym",
	"Hyponym",
	"Meronym",
	"Holonym",
] as const;

const DeRelationSubKindSchema = z.enum(relationSubKinds);

export const DeRelationOutputSchema = z.object({
	relations: z.array(
		z.object({
			kind: DeRelationSubKindSchema,
			words: z.array(z.string()),
		}),
	),
});

export const DeInflectionInputSchema =
	buildContextualInputSchema(DeLexemTargetSchema);

export const DeInflectionOutputSchema = z.object({
	rows: z.array(
		z.object({
			forms: z.string().min(1),
			label: z.string().min(1).max(60),
		}),
	),
});

export const DeFeaturesInputSchema =
	buildContextualInputSchema(DeLexemTargetSchema);

const deFeatureTagOutputSchema = z.object({
	tags: z.array(z.string().min(1).max(30)).min(1).max(5),
});
const deVerbFeatureOutputSchema = z
	.object({
		conjugation: LexicalVerbConjugationSchema,
		valency: LexicalVerbValencySchema,
	})
	.strict();

export const DeFeaturesOutputSchema = z.union([
	deFeatureTagOutputSchema,
	deVerbFeatureOutputSchema,
]);

export const DeWordTranslationInputSchema = buildContextualInputSchema(
	DeLexicalTargetSchema,
);

export const DeWordTranslationOutputSchema = z
	.string()
	.describe("Translated word or phrase");
