import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Poss.html
export const Poss = z.literal("Yes");
export type Poss = z.infer<typeof Poss>;

export function getReprForPoss(_poss: Poss) {
	const reprForPoss = "possessive";

	return reprForPoss;
}

export const PossPart = z.object({ poss: Poss });
