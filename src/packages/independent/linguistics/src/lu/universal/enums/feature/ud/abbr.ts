import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Abbr.html

export const Abbr = z.literal("Yes");
export type Abbr = z.infer<typeof Abbr>;

function getReprForAbbr(_abbr: Abbr) {
	const reprForAbbr = "abbreviation";

	return reprForAbbr;
}
