import { z } from "zod/v3";
import type { Prettify } from "../../../../../../../types/helpers";
import type { LexicalRelation } from "./lexical";
import type { MorphologicalRelation } from "./morphological";

function buildRelationTargetsSchema() {
	return z
		.array(z.string())
		.min(1)
		.superRefine((targets, ctx) => {
			const seen = new Set<string>();

			for (const target of targets) {
				if (seen.has(target)) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Relation targets must be unique",
					});
					return;
				}

				seen.add(target);
			}
		});
}

export const RelationTargetsSchema = buildRelationTargetsSchema();

export type RelationTargets = z.infer<typeof RelationTargetsSchema>;

export type LexicalRelations = Prettify<
	Partial<Record<LexicalRelation, RelationTargets>>
>;

export type MorphologicalRelations = Prettify<
	Partial<Record<MorphologicalRelation, RelationTargets>>
>;

export type AbstractLexicalRelations = LexicalRelations;
export type AbstractMorphologicalRelations = MorphologicalRelations;

const lexicalRelationsShape = {
	antonym: RelationTargetsSchema.optional(),
	holonym: RelationTargetsSchema.optional(),
	hypernym: RelationTargetsSchema.optional(),
	hyponym: RelationTargetsSchema.optional(),
	meronym: RelationTargetsSchema.optional(),
	nearSynonym: RelationTargetsSchema.optional(),
	synonym: RelationTargetsSchema.optional(),
} satisfies Record<
	LexicalRelation,
	z.ZodOptional<typeof RelationTargetsSchema>
>;

const morphologicalRelationsShape = {
	consistsOf: RelationTargetsSchema.optional(),
	derivedFrom: RelationTargetsSchema.optional(),
	sourceFor: RelationTargetsSchema.optional(),
	usedIn: RelationTargetsSchema.optional(),
} satisfies Record<
	MorphologicalRelation,
	z.ZodOptional<typeof RelationTargetsSchema>
>;

export const LexicalRelationsSchema = z
	.object(lexicalRelationsShape)
	.strict() satisfies z.ZodType<LexicalRelations>;

export const MorphologicalRelationsSchema = z
	.object(morphologicalRelationsShape)
	.strict() satisfies z.ZodType<MorphologicalRelations>;

export const AbstractLexicalRelationsSchema = LexicalRelationsSchema;
export const AbstractMorphologicalRelationsSchema = MorphologicalRelationsSchema;
