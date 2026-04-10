import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Abbr.html

export const IsAbbr = z.boolean();
export type IsAbbr = z.infer<typeof IsAbbr>;
export const IS_ABBR_KEY = "abbr";

export function getReprForIsAbbr(isAbbr: IsAbbr) {
	const reprForIsAbbr = "abbreviation";

	return isAbbr ? reprForIsAbbr : `not ${reprForIsAbbr}`;
}
