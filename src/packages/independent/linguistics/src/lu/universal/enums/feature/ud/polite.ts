import { z } from "zod/v3";

const politeValues = ["Elev", "Form", "Humb", "Infm"] as const;

// Source: https://universaldependencies.org/u/feat/Polite.html
export const Polite = z.enum(politeValues);
export type Polite = z.infer<typeof Polite>;

const reprForPolite = {
	Elev: "referent elevating",
	Form: "formal register",
	Humb: "speaker humbling",
	Infm: "informal register",
} satisfies Record<Polite, string>;

function getReprForPolite(polite: Polite) {
	return reprForPolite[polite];
}
