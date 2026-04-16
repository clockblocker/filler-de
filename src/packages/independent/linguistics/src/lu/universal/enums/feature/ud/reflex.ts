import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Reflex.html
export const Reflex = z.literal("Yes");
export type Reflex = z.infer<typeof Reflex>;

function getReprForReflex(_reflex: Reflex) {
	const reprForReflex = "reflexive";

	return reprForReflex;
}
