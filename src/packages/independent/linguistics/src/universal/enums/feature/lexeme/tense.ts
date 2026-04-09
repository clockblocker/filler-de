import { z } from "zod/v3";

const tenseValues = ["Fut", "Imp", "Past", "Pqp", "Pres"] as const;

// Source: https://universaldependencies.org/u/feat/Tense.html
export const Tense = z.enum(tenseValues);
export type Tense = z.infer<typeof Tense>;
export const TENSE_KEY = "tense";

const reprForTense = {
	Fut: "future",
	Imp: "imperfect",
	Past: "past", // preterite / aorist
	Pqp: "pluperfect",
	Pres: "present", // non-past / aorist
} satisfies Record<Tense, string>;

export function getReprForTense(tense: Tense) {
	return reprForTense[tense];
}
