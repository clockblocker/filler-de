import { z } from "zod/v3";

const numFormValues = ["Combi", "Digit", "Roman", "Word"] as const;

// Source: https://universaldependencies.org/u/feat/NumForm.html
export const NumForm = z.enum(numFormValues);
export type NumForm = z.infer<typeof NumForm>;

const reprForNumForm = {
	Combi: "combined numeric form",
	Digit: "digit-based numeric form",
	Roman: "Roman numeral",
	Word: "word-based numeric form",
} satisfies Record<NumForm, string>;

export function getReprForNumForm(numForm: NumForm) {
	return reprForNumForm[numForm];
}
