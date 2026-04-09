import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Abbr.html

export const ABBR_KEY = "abbr";
export const Abbr = z.boolean();
export type Abbr = z.infer<typeof Abbr>;

export function getReprForAbbr(abbr: Abbr) {
	const reprForAbbr = "abbreviation";

	return abbr ? reprForAbbr : `not ${reprForAbbr}`;
}

export const AbbrPart = z.object({ [ABBR_KEY]: Abbr });
