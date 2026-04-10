import { z } from "zod/v3";

const genderValues = ["Com", "Fem", "Masc", "Neut"] as const;

// Source: https://universaldependencies.org/u/feat/Gender.html
export const Gender = z.enum(genderValues);
export type Gender = z.infer<typeof Gender>;
export const GENDER_KEY = "gender";

const reprForGender = {
	Com: "common",
	Fem: "feminine",
	Masc: "masculine",
	Neut: "neuter",
} satisfies Record<Gender, string>;

export function getReprForGender(gender: Gender) {
	return reprForGender[gender];
}
