import { z } from "zod/v3";

const deixisRefValues = ["1", "2"] as const;

// Source: https://universaldependencies.org/u/feat/DeixisRef.html
export const DeixisRef = z.enum(deixisRefValues);
export type DeixisRef = z.infer<typeof DeixisRef>;

const deixisRefRepr = {
	"1": "deixis relative to the first person participant (speaker)",
	"2": "deixis relative to the second person participant (hearer)",
} satisfies Record<DeixisRef, string>;

export function reprForDeixisRef(deixisRef: DeixisRef) {
	return deixisRefRepr[deixisRef];
}
