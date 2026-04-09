import { z } from "zod/v3";

const deixisValues = [
	"Abv",
	"Bel",
	"Even",
	"Med",
	"Nvis",
	"Prox",
	"Remt",
] as const;

// Source: https://universaldependencies.org/u/feat/Deixis.html
export const Deixis = z.enum(deixisValues);
export type Deixis = z.infer<typeof Deixis>;

const deixisRepr = {
	Abv: "above the reference point",
	Bel: "below the reference point",
	Even: "at the same level as the reference point",
	Med: "medial",
	Nvis: "not visible",
	Prox: "proximate",
	Remt: "remote, distal",
} satisfies Record<Deixis, string>;

export function reprForDeixis(deixis: Deixis) {
	return deixisRepr[deixis];
}
