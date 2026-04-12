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

const relationTargetsSchema = buildRelationTargetsSchema();

export type RelationTargets = z.infer<typeof relationTargetsSchema>;

export type AbstractLexicalRelations = Prettify<
	Partial<Record<LexicalRelation, RelationTargets>>
>;

export type AbstractMorphologicalRelations = Prettify<
	Partial<Record<MorphologicalRelation, RelationTargets>>
>;

const lexicalRelationsShape = {
	antonym: relationTargetsSchema.optional(),
	holonym: relationTargetsSchema.optional(),
	hypernym: relationTargetsSchema.optional(),
	hyponym: relationTargetsSchema.optional(),
	meronym: relationTargetsSchema.optional(),
	nearSynonym: relationTargetsSchema.optional(),
	synonym: relationTargetsSchema.optional(),
} satisfies Record<
	LexicalRelation,
	z.ZodOptional<typeof relationTargetsSchema>
>;

const morphologicalRelationsShape = {
	consistsOf: relationTargetsSchema.optional(),
	derivedFrom: relationTargetsSchema.optional(),
	sourceFor: relationTargetsSchema.optional(),
	usedIn: relationTargetsSchema.optional(),
} satisfies Record<
	MorphologicalRelation,
	z.ZodOptional<typeof relationTargetsSchema>
>;

export const AbstractLexicalRelationsSchema = z
	.object(lexicalRelationsShape)
	.strict() satisfies z.ZodType<AbstractLexicalRelations>;

export const AbstractMorphologicalRelationsSchema = z
	.object(morphologicalRelationsShape)
	.strict() satisfies z.ZodType<AbstractMorphologicalRelations>;
