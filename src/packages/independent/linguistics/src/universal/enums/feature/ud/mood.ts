import { z } from "zod/v3";

const moodValues = [
	"Adm",
	"Cnd",
	"Des",
	"Imp",
	"Ind",
	"Int",
	"Irr",
	"Jus",
	"Nec",
	"Opt",
	"Pot",
	"Prp",
	"Qot",
	"Sub",
] as const;

// Source: https://universaldependencies.org/u/feat/Mood.html
export const Mood = z.enum(moodValues);
export type Mood = z.infer<typeof Mood>;
export const MOOD_KEY = "mood";

const reprForMood = {
	Adm: "admirative",
	Cnd: "conditional",
	Des: "desiderative",
	Imp: "imperative",
	Ind: "indicative", // or realis
	Int: "interrogative",
	Irr: "irrealis",
	Jus: "jussive", // or injunctive
	Nec: "necessitative",
	Opt: "optative",
	Pot: "potential",
	Prp: "purposive",
	Qot: "quotative",
	Sub: "subjunctive", // or conjunctive
} satisfies Record<Mood, string>;

export function getReprForMood(mood: Mood) {
	return reprForMood[mood];
}
