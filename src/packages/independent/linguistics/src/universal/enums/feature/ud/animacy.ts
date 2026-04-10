import { z } from "zod/v3";

const animacyValues = ["Anim", "Hum", "Inan", "Nhum"] as const;

// Source: https://universaldependencies.org/u/feat/Animacy.html
export const Animacy = z.enum(animacyValues);
export type Animacy = z.infer<typeof Animacy>;
export const ANIMACITY_KEY = "animacy";

const reprForAnimacy = {
	Anim: "animate",
	Hum: "human",
	Inan: "inanimate",
	Nhum: "non-human",
} satisfies Record<Animacy, string>;

export function getReprForAnimacy(animacy: Animacy) {
	return reprForAnimacy[animacy];
}
