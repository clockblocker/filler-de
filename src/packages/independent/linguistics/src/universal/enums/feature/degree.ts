import { z } from "zod/v3";

const degreeValues = ["Abs", "Aug", "Cmp", "Dim", "Equ", "Pos", "Sup"] as const;

// Source: https://universaldependencies.org/u/feat/Degree.html
export const Degree = z.enum(degreeValues);
export type Degree = z.infer<typeof Degree>;

const degreeRepr = {
	Abs: "absolute superlative",
	Aug: "augmentative",
	Cmp: "comparative, second degree",
	Dim: "diminutive",
	Equ: "equative",
	Pos: "positive, first degree",
	Sup: "superlative, third degree",
} satisfies Record<Degree, string>;

export function reprForDegree(degree: Degree) {
	return degreeRepr[degree];
}
