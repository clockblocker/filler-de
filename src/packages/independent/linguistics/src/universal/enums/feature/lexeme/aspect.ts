import { z } from "zod/v3";

const aspectValues = ["Hab", "Imp", "Iter", "Perf", "Prog", "Prosp"] as const;

// Source: https://universaldependencies.org/u/feat/Aspect.html
export const Aspect = z.enum(aspectValues);
export type Aspect = z.infer<typeof Aspect>;

const reprForAspect = {
	Hab: "habitual aspect",
	Imp: "imperfect aspect",
	Iter: "iterative / frequentative aspect",
	Perf: "perfect aspect",
	Prog: "progressive aspect",
	Prosp: "prospective aspect",
} satisfies Record<Aspect, string>;

export function getReprForAspect(aspect: Aspect) {
	return reprForAspect[aspect];
}
