import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Typo.html
export const Typo = z.literal("Yes");
export type Typo = z.infer<typeof Typo>;

export function getReprForTypo(_typo: Typo) {
	const reprForTypo = "contains a typo";

	return reprForTypo;
}
