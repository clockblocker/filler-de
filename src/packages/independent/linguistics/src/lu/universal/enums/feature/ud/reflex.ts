import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Reflex.html
export const IsReflex = z.boolean();
export type IsReflex = z.infer<typeof IsReflex>;

export function getReprForIsReflex(isReflex: IsReflex) {
	const reprForIsReflex = "reflexive";

	return isReflex ? reprForIsReflex : `not ${reprForIsReflex}`;
}
