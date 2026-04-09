import { z } from "zod/v3";

const genderValues = ["Com", "Fem", "Masc", "Neut"] as const;

// Source: https://universaldependencies.org/u/feat/Gender.html
export const Gender = z.enum(genderValues);
export type Gender = z.infer<typeof Gender>;

const reprForGender = {
	Com: "common gender",
	Fem: "feminine gender",
	Masc: "masculine gender",
	Neut: "neuter gender",
} satisfies Record<Gender, string>;

export function getReprForGender(gender: Gender) {
	return reprForGender[gender];
}
