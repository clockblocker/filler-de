import { z } from "zod/v3";

const possValues = ["Yes"] as const;

// Source: https://universaldependencies.org/u/feat/Poss.html
export const Poss = z.enum(possValues);
export type Poss = z.infer<typeof Poss>;

const reprForPoss = {
	Yes: "possessive",
} satisfies Record<Poss, string>;

export function getReprForPoss(poss: Poss) {
	return reprForPoss[poss];
}
