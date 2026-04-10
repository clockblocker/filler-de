import z from "zod";

const morphologicalRelations = [
	"Consists of",
	"Derived from",
	"Used in",
] as const;

export const MorphologicalRelation = z.enum(morphologicalRelations);
export type MorphologicalRelation = z.infer<typeof MorphologicalRelation>;

const reprForMorphologicalRelation = {
	"Consists of": "⊃",
	"Derived from": "←",
	"Used in": "→",
} satisfies Record<MorphologicalRelation, string>;

export function getReprForMorphologicalRelation(
	morphologicalRelation: MorphologicalRelation,
) {
	return reprForMorphologicalRelation[morphologicalRelation];
}
