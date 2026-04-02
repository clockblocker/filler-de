import { z } from "zod/v3";

const typoValues = ["Yes"] as const;

// Source: https://universaldependencies.org/u/feat/Typo.html
export const Typo = z.enum(typoValues);
export type Typo = z.infer<typeof Typo>;

const typoRepr = {
	Yes: "typo",
} satisfies Record<Typo, string>;

export function reprForTypo(typo: Typo) {
	return typoRepr[typo];
}
