import { z } from "zod/v3";

const reflexValues = ["Yes"] as const;

// Source: https://universaldependencies.org/u/feat/Reflex.html
export const Reflex = z.enum(reflexValues);
export type Reflex = z.infer<typeof Reflex>;

const reflexRepr = {
	Yes: "reflexive",
} satisfies Record<Reflex, string>;

export function reprForReflex(reflex: Reflex) {
	return reflexRepr[reflex];
}
