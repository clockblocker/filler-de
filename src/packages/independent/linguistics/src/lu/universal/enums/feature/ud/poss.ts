import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Poss.html
export const Poss = z.literal("Yes");
export type Poss = z.infer<typeof Poss>;

function getReprForPoss(_poss: Poss) {
	const reprForPoss = "possessive";

	return reprForPoss;
}

const PossPart = z.object({ poss: Poss });
