import { z } from "zod/v3";

const possValues = ["Yes"] as const;

// Source: https://universaldependencies.org/u/feat/Poss.html
export const Poss = z.enum(possValues);
export type Poss = z.infer<typeof Poss>;

const possRepr = {
	Yes: "possessive",
} satisfies Record<Poss, string>;

export function reprForPoss(poss: Poss) {
	return possRepr[poss];
}
