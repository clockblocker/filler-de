import z from "zod";

const morphologicalRelations = ["ConsistsOf", "DerivedFrom", "UsedIn"] as const;

export const MorphologicalRelation = z.enum(morphologicalRelations);
export type MorphologicalRelation = z.infer<typeof MorphologicalRelation>;

const reprForMorphologicalRelation = {
	ConsistsOf: "⊃",
	DerivedFrom: "←",
	UsedIn: "→",
} satisfies Record<MorphologicalRelation, string>;

export function getReprForMorphologicalRelation(
	morphologicalRelation: MorphologicalRelation,
) {
	return reprForMorphologicalRelation[morphologicalRelation];
}
