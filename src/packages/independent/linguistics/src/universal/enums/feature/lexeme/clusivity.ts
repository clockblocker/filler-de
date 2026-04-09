import { z } from "zod/v3";

const clusivityValues = ["Ex", "In"] as const;

// Source: https://universaldependencies.org/u/feat/Clusivity.html
export const Clusivity = z.enum(clusivityValues);
export type Clusivity = z.infer<typeof Clusivity>;

const clusivityRepr = {
	Ex: "exclusive",
	In: "inclusive",
} satisfies Record<Clusivity, string>;

export function reprForClusivity(clusivity: Clusivity) {
	return clusivityRepr[clusivity];
}
