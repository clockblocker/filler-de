import { z } from "zod/v3";

const definiteValues = ["Com", "Cons", "Def", "Ind", "Spec"] as const;

// Source: https://universaldependencies.org/u/feat/Definite.html
export const Definite = z.enum(definiteValues);
export type Definite = z.infer<typeof Definite>;
export const DEFINITE_KEY = "definite";

const reprForDefinite = {
	Com: "complex",
	Cons: "construct state / reduced definiteness",
	Def: "definite",
	Ind: "indefinite",
	Spec: "specific indefinite",
} satisfies Record<Definite, string>;

export function getReprForDefinite(definite: Definite) {
	return reprForDefinite[definite];
}
