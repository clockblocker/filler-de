import { z } from "zod/v3";

const aspectValues = ["Hab", "Imp", "Iter", "Perf", "Prog", "Prosp"] as const;

// Source: https://universaldependencies.org/u/feat/Aspect.html
export const Aspect = z.enum(aspectValues);
export type Aspect = z.infer<typeof Aspect>;

const aspectRepr = {
	Hab: "habitual aspect",
	Imp: "imperfect aspect",
	Iter: "iterative / frequentative aspect",
	Perf: "perfect aspect",
	Prog: "progressive aspect",
	Prosp: "prospective aspect",
} satisfies Record<Aspect, string>;

export function reprForAspect(aspect: Aspect) {
	return aspectRepr[aspect];
}
