import { z } from "zod/v3";

const morphologicalRelations = [
	"consistsOf",
	"derivedFrom",
	"usedIn",
	"sourceFor",
] as const;

export const MorphologicalRelation = z.enum(morphologicalRelations);
export type MorphologicalRelation = z.infer<typeof MorphologicalRelation>;

const inverseMorphologicalRelation = {
	consistsOf: "usedIn",
	derivedFrom: "sourceFor",
	sourceFor: "derivedFrom",
	usedIn: "consistsOf",
} as const satisfies Record<MorphologicalRelation, MorphologicalRelation>;

const reprForMorphologicalRelation = {
	consistsOf: "⊃",
	derivedFrom: "<-",
	sourceFor: "->",
	usedIn: "⊂",
} as const satisfies Record<MorphologicalRelation, string>;

export function getInverseMorphologicalRelation(
	morphologicalRelation: MorphologicalRelation,
): MorphologicalRelation {
	return inverseMorphologicalRelation[morphologicalRelation];
}

export function getReprForMorphologicalRelation(
	morphologicalRelation: MorphologicalRelation,
) {
	return reprForMorphologicalRelation[morphologicalRelation];
}
