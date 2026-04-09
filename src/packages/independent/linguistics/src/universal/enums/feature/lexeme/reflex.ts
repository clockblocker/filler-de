import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Reflex.html
export const REFLEX_KEY = "reflex";
export const Reflex = z.boolean();
export type Reflex = z.infer<typeof Reflex>;

export function getReprForReflex(reflex: Reflex) {
	const reprForReflex = "reflexive";

	return reflex ? reprForReflex : `not ${reprForReflex}`;
}
