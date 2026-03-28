import { z } from "zod/v3";
import {
	LEXICAL_PHRASEME_KIND_VALUES,
	LEXICAL_POS_VALUES,
	LexicalPhrasemeKindSchema,
	LexicalSurfaceKindSchema,
} from "../../schema-primitives";

const deLemmaLinguisticUnits = ["Lexem", "Phrasem"] as const;

export const DeLemmaLinguisticUnitSchema = z.enum(deLemmaLinguisticUnits);
export type DeLemmaLinguisticUnit = z.infer<typeof DeLemmaLinguisticUnitSchema>;
export const DeLemmaLinguisticUnit = DeLemmaLinguisticUnitSchema.enum;
export const DE_LEMMA_LINGUISTIC_UNITS = DeLemmaLinguisticUnitSchema.options;

export const DeLexemPosSchema = z.enum(LEXICAL_POS_VALUES);
export type DeLexemPos = z.infer<typeof DeLexemPosSchema>;
export const DE_LEXEM_POS = DeLexemPosSchema.options;

export const DePosLikeKindSchema = z.union([
	DeLexemPosSchema,
	LexicalPhrasemeKindSchema,
]);
export type DePosLikeKind = z.infer<typeof DePosLikeKindSchema>;

const deLemmaResultBaseSchema = z.object({
	contextWithLinkedParts: z.string(),
	lemma: z.string(),
	surfaceKind: LexicalSurfaceKindSchema,
});

export const DeLexemLemmaResultSchema = deLemmaResultBaseSchema.extend({
	linguisticUnit: z.literal("Lexem"),
	posLikeKind: DeLexemPosSchema,
});

export const DePhrasemLemmaResultSchema = deLemmaResultBaseSchema.extend({
	linguisticUnit: z.literal("Phrasem"),
	posLikeKind: z.enum(LEXICAL_PHRASEME_KIND_VALUES),
});

export const DeLemmaResultSchema = z
	.discriminatedUnion("linguisticUnit", [
		DeLexemLemmaResultSchema,
		DePhrasemLemmaResultSchema,
	])
	.transform((value) => {
		return {
			contextWithLinkedParts: value.contextWithLinkedParts,
			lemma: value.lemma,
			linguisticUnit: value.linguisticUnit,
			posLikeKind: value.posLikeKind,
			surfaceKind: value.surfaceKind,
		};
	});
export type DeLemmaResult = z.infer<typeof DeLemmaResultSchema>;
