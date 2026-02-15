import { z } from "zod/v3";
import { SurfaceKindSchema } from "../../common/enums/core";
import { PARTS_OF_SPEECH_STR } from "../../common/enums/linguistic-units/lexem/pos";
import { PhrasemeKindSchema } from "../../common/enums/linguistic-units/phrasem/phrasem-kind";

const deLemmaLinguisticUnits = ["Lexem", "Phrasem"] as const;

export const DeLemmaLinguisticUnitSchema = z.enum(deLemmaLinguisticUnits);
export type DeLemmaLinguisticUnit = z.infer<typeof DeLemmaLinguisticUnitSchema>;
export const DeLemmaLinguisticUnit = DeLemmaLinguisticUnitSchema.enum;
export const DE_LEMMA_LINGUISTIC_UNITS = DeLemmaLinguisticUnitSchema.options;

// Re-create POS schema with zod/v3 (pos.ts uses zod v4).
export const DeLexemPosSchema = z.enum(PARTS_OF_SPEECH_STR);
export type DeLexemPos = z.infer<typeof DeLexemPosSchema>;
export const DE_LEXEM_POS = DeLexemPosSchema.options;

export const DePosLikeKindSchema = z.union([
	DeLexemPosSchema,
	PhrasemeKindSchema,
]);
export type DePosLikeKind = z.infer<typeof DePosLikeKindSchema>;

const deLemmaResultBaseSchema = z.object({
	contextWithLinkedParts: z.string().nullable().optional(),
	lemma: z.string(),
	surfaceKind: SurfaceKindSchema,
});

export const DeLexemLemmaResultSchema = deLemmaResultBaseSchema.extend({
	linguisticUnit: z.literal("Lexem"),
	posLikeKind: DeLexemPosSchema,
});

export const DePhrasemLemmaResultSchema = deLemmaResultBaseSchema.extend({
	linguisticUnit: z.literal("Phrasem"),
	posLikeKind: PhrasemeKindSchema,
});

export const DeLemmaResultSchema = z.discriminatedUnion("linguisticUnit", [
	DeLexemLemmaResultSchema,
	DePhrasemLemmaResultSchema,
]);
export type DeLemmaResult = z.infer<typeof DeLemmaResultSchema>;
