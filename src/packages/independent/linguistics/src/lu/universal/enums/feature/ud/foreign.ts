import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Foreign.html
export const Foreign = z.literal("Yes");
export type Foreign = z.infer<typeof Foreign>;

export function getReprForForeign(_foreign: Foreign) {
	const reprForForeign = "foreign";

	return reprForForeign;
}
