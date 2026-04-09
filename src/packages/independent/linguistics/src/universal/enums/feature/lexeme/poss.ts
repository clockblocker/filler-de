import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Poss.html
export const POSS_KEY = "poss";
export const Poss = z.boolean();
export type Poss = z.infer<typeof Poss>;

export function getReprForPoss(poss: Poss) {
	const reprForPoss = "possessive";

	return poss ? reprForPoss : `not ${reprForPoss}`;
}

export const PossPart = z.object({ [POSS_KEY]: Poss });
