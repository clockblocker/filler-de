import { z } from "zod/v3";

const tenseValues = ["Fut", "Imp", "Past", "Pqp", "Pres"] as const;

// Source: https://universaldependencies.org/u/feat/Tense.html
export const Tense = z.enum(tenseValues);
export type Tense = z.infer<typeof Tense>;

const tenseRepr = {
	Fut: "future tense",
	Imp: "imperfect",
	Past: "past tense / preterite / aorist",
	Pqp: "pluperfect",
	Pres: "present / non-past tense / aorist",
} satisfies Record<Tense, string>;

export function reprForTense(tense: Tense) {
	return tenseRepr[tense];
}
