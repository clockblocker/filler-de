import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Foreign.html
export const FOREIGN_KEY = "foreign";
export const Foreign = z.boolean();
export type Foreign = z.infer<typeof Foreign>;

export function getReprForForeign(foreign: Foreign) {
	const reprForForeign = "foreign";

	return foreign ? reprForForeign : `not ${reprForForeign}`;
}
