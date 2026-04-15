import { z } from "zod/v3";

const punctTypeValues = [
	"Brck",
	"Colo",
	"Comm",
	"Dash",
	"Elip",
	"Excl",
	"Peri",
	"Qest",
	"Quot",
] as const;

// Source: https://universaldependencies.org/u/feat/PunctType.html
export const PunctType = z.enum(punctTypeValues);
export type PunctType = z.infer<typeof PunctType>;
