import { z } from "zod/v3";
import type { Prettify } from "../../../../../types/helpers";
import type { LingId } from "../ling-id/types";
import type { LexicalRelation } from "./lexical";
import type { MorphologicalRelation } from "./morphological";

export const RelationTargetLingIdsSchema = z.array(
	z.string(),
) satisfies z.ZodType<RelationTargetLingIds>;

export type RelationTargetLingIds = LingId[];

export type LexicalRelations = Prettify<
	Partial<Record<LexicalRelation, RelationTargetLingIds>>
>;

export type MorphologicalRelations = Prettify<
	Partial<Record<MorphologicalRelation, RelationTargetLingIds>>
>;

export type AbstractLexicalRelations = LexicalRelations;
export type AbstractMorphologicalRelations = MorphologicalRelations;

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
	.strict() satisfies z.ZodType<LexicalRelations>;

export const MorphologicalRelationsSchema = z
	.object(morphologicalRelationsShape)
	.strict() satisfies z.ZodType<MorphologicalRelations>;

export const AbstractLexicalRelationsSchema = LexicalRelationsSchema;
export const AbstractMorphologicalRelationsSchema =
	MorphologicalRelationsSchema;
