import { z } from "zod/v3";
import type { Prettify } from "../../../../../types/helpers";
import { decodeLingId } from "../ling-id/internal/codec/decode";
import { parseHeader } from "../ling-id/internal/wire/header";
import type { LingId } from "../ling-id/public";
import type { LexicalRelation } from "./lexical";
import type { MorphologicalRelation } from "./morphological";

const LemmaLingIdSchema = z.string().superRefine((value, ctx) => {
	try {
		const header = parseHeader(value);

		if (header.kind !== "Lemma") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `Expected lemma Ling ID, received ${header.kind}`,
			});
			return;
		}

		const decoded = decodeLingId(header.language, value);

		if (decoded.isErr()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: decoded.error.message,
			});
		}
	} catch (error) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message:
				error instanceof Error
					? error.message
					: "Malformed relation Ling ID",
		});
	}
}) as unknown as z.ZodType<LingId<"Lemma">>;

export const RelationTargetLingIdsSchema = z.array(
	LemmaLingIdSchema,
) as unknown as z.ZodType<RelationTargetLingIds>;

export type RelationTargetLingIds = LingId<"Lemma">[];

export type LexicalRelations = Prettify<
	Partial<Record<LexicalRelation, RelationTargetLingIds>>
>;

export type MorphologicalRelations = Prettify<
	Partial<Record<MorphologicalRelation, RelationTargetLingIds>>
>;

const lexicalRelationsShape = {
	antonym: RelationTargetLingIdsSchema.optional(),
	holonym: RelationTargetLingIdsSchema.optional(),
	hypernym: RelationTargetLingIdsSchema.optional(),
	hyponym: RelationTargetLingIdsSchema.optional(),
	meronym: RelationTargetLingIdsSchema.optional(),
	nearSynonym: RelationTargetLingIdsSchema.optional(),
	synonym: RelationTargetLingIdsSchema.optional(),
} satisfies Record<
	LexicalRelation,
	z.ZodOptional<typeof RelationTargetLingIdsSchema>
>;

const morphologicalRelationsShape = {
	consistsOf: RelationTargetLingIdsSchema.optional(),
	derivedFrom: RelationTargetLingIdsSchema.optional(),
	sourceFor: RelationTargetLingIdsSchema.optional(),
	usedIn: RelationTargetLingIdsSchema.optional(),
} satisfies Record<
	MorphologicalRelation,
	z.ZodOptional<typeof RelationTargetLingIdsSchema>
>;

export const LexicalRelationsSchema = z
	.object(lexicalRelationsShape)
	.strict() as unknown as z.ZodType<LexicalRelations>;

export const MorphologicalRelationsSchema = z
	.object(morphologicalRelationsShape)
	.strict() as unknown as z.ZodType<MorphologicalRelations>;
