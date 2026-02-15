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

const deLemmaResultCompatInputSchema = deLemmaResultBaseSchema.extend({
	linguisticUnit: DeLemmaLinguisticUnitSchema,
	phrasemeKind: PhrasemeKindSchema.nullable().optional(),
	pos: DeLexemPosSchema.nullable().optional(),
	posLikeKind: DePosLikeKindSchema.nullable().optional(),
});

export const DeLemmaResultSchema = deLemmaResultCompatInputSchema
	.superRefine((value, ctx) => {
		if (value.linguisticUnit === "Lexem") {
			if (
				value.phrasemeKind !== undefined &&
				value.phrasemeKind !== null
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message:
						'Lexem must not provide "phrasemeKind" (legacy alias is only valid for Phrasem)',
					path: ["phrasemeKind"],
				});
			}

			const posLikeAsLexem = DeLexemPosSchema.safeParse(
				value.posLikeKind,
			);
			if (
				value.posLikeKind !== undefined &&
				value.posLikeKind !== null &&
				!posLikeAsLexem.success
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message:
						'Lexem "posLikeKind" must be a lexical POS (Noun, Verb, ...)',
					path: ["posLikeKind"],
				});
			}

			if (
				!posLikeAsLexem.success &&
				(value.pos === undefined || value.pos === null)
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message:
						'Lexem requires either canonical "posLikeKind" or legacy "pos"',
					path: ["posLikeKind"],
				});
			}

			if (
				posLikeAsLexem.success &&
				value.pos &&
				value.pos !== posLikeAsLexem.data
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message:
						'Conflicting Lexem POS values: "posLikeKind" and "pos" must match',
					path: ["posLikeKind"],
				});
			}
			return;
		}

		if (value.pos !== undefined && value.pos !== null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					'Phrasem must not provide "pos" (legacy alias is only valid for Lexem)',
				path: ["pos"],
			});
		}

		const posLikeAsPhrasem = PhrasemeKindSchema.safeParse(
			value.posLikeKind,
		);
		if (
			value.posLikeKind !== undefined &&
			value.posLikeKind !== null &&
			!posLikeAsPhrasem.success
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					'Phrasem "posLikeKind" must be a phraseme kind (Idiom, Collocation, ...)',
				path: ["posLikeKind"],
			});
		}

		if (
			!posLikeAsPhrasem.success &&
			(value.phrasemeKind === undefined || value.phrasemeKind === null)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					'Phrasem requires either canonical "posLikeKind" or legacy "phrasemeKind"',
				path: ["posLikeKind"],
			});
		}

		if (
			posLikeAsPhrasem.success &&
			value.phrasemeKind &&
			value.phrasemeKind !== posLikeAsPhrasem.data
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					'Conflicting Phrasem kind values: "posLikeKind" and "phrasemeKind" must match',
				path: ["posLikeKind"],
			});
		}
	})
	.transform((value) => {
		const contextWithLinkedParts =
			value.contextWithLinkedParts ?? undefined;

		if (value.linguisticUnit === "Lexem") {
			const parsedPosLikeKind = DeLexemPosSchema.safeParse(
				value.posLikeKind,
			);
			const posLikeKind = parsedPosLikeKind.success
				? parsedPosLikeKind.data
				: value.pos;

			if (!posLikeKind) {
				throw new Error(
					'Invalid Lexem lemma result: missing both "posLikeKind" and "pos"',
				);
			}

			return {
				contextWithLinkedParts,
				lemma: value.lemma,
				linguisticUnit: "Lexem" as const,
				posLikeKind,
				surfaceKind: value.surfaceKind,
			};
		}

		const parsedPhrasemeLikeKind = PhrasemeKindSchema.safeParse(
			value.posLikeKind,
		);
		const posLikeKind = parsedPhrasemeLikeKind.success
			? parsedPhrasemeLikeKind.data
			: value.phrasemeKind;

		if (!posLikeKind) {
			throw new Error(
				'Invalid Phrasem lemma result: missing both "posLikeKind" and "phrasemeKind"',
			);
		}

		return {
			contextWithLinkedParts,
			lemma: value.lemma,
			linguisticUnit: "Phrasem" as const,
			posLikeKind,
			surfaceKind: value.surfaceKind,
		};
	});
export type DeLemmaResult = z.infer<typeof DeLemmaResultSchema>;
