import { z } from "zod/v3";

const abbrValues = ["Yes"] as const;

// Source: https://universaldependencies.org/u/feat/Abbr.html
export const Abbr = z.enum(abbrValues);
export type Abbr = z.infer<typeof Abbr>;

const abbrRepr = {
	Yes: "abbreviation",
} satisfies Record<Abbr, string>;

export function reprForAbbr(abbr: Abbr) {
	return abbrRepr[abbr];
}
