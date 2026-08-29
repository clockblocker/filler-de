import { z } from "zod/v3";
import {
	LEXICAL_PHRASEME_KIND_VALUES,
	LEXICAL_POS_VALUES,
	LexicalSurfaceKindSchema,
} from "../../schema-primitives";

const deLemmaLinguisticUnits = ["Lexem", "Phrasem"] as const;

const DeLemmaLinguisticUnitSchema = z.enum(deLemmaLinguisticUnits);
export const DE_LEMMA_LINGUISTIC_UNITS = DeLemmaLinguisticUnitSchema.options;

export const DeLexemPosSchema = z.enum(LEXICAL_POS_VALUES);
export const DE_LEXEM_POS = DeLexemPosSchema.options;


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
