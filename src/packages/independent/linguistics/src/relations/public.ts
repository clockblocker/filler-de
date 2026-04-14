import type z from "zod/v3";
import {
	getInverseLexicalRelation,
	getReprForLexicalRelation,
	LexicalRelation as LexicalRelationSchema,
} from "./lexical";
import {
	getInverseMorphologicalRelation,
	getReprForMorphologicalRelation,
	MorphologicalRelation as MorphologicalRelationSchema,
} from "./morphological";
import {
	LexicalRelationsSchema as LexicalRelationsSchemaInternal,
	type LexicalRelations as LexicalRelationsShape,
	MorphologicalRelationsSchema as MorphologicalRelationsSchemaInternal,
	type MorphologicalRelations as MorphologicalRelationsShape,
	RelationTargetsSchema as RelationTargetsSchemaInternal,
	type RelationTargets as RelationTargetsShape,
} from "./relation";

export {
	getInverseLexicalRelation,
	getReprForLexicalRelation,
} from "./lexical";
export {
	getInverseMorphologicalRelation,
	getReprForMorphologicalRelation,
} from "./morphological";

export const LexicalRelation = LexicalRelationSchema.enum;
export const MorphologicalRelation = MorphologicalRelationSchema.enum;
export const RelationTargetsSchema = RelationTargetsSchemaInternal;
export const LexicalRelationsSchema = LexicalRelationsSchemaInternal;
export const MorphologicalRelationsSchema =
	MorphologicalRelationsSchemaInternal;

export const Relations = {
	Lexical: {
		enum: LexicalRelation,
		getInverse: getInverseLexicalRelation,
		getRepr: getReprForLexicalRelation,
		schema: LexicalRelationsSchema,
	},
	Morphological: {
		enum: MorphologicalRelation,
		getInverse: getInverseMorphologicalRelation,
		getRepr: getReprForMorphologicalRelation,
		schema: MorphologicalRelationsSchema,
	},
	targetsSchema: RelationTargetsSchema,
} as const;

export type LexicalRelation = z.infer<typeof LexicalRelationSchema>;
export type MorphologicalRelation = z.infer<typeof MorphologicalRelationSchema>;
export type RelationTargets = RelationTargetsShape;
export type LexicalRelations = LexicalRelationsShape;
export type MorphologicalRelations = MorphologicalRelationsShape;
