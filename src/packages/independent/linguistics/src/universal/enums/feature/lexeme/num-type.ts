import { z } from "zod/v3";

const numTypeValues = [
	"Card",
	"Dist",
	"Frac",
	"Mult",
	"Ord",
	"Range",
	"Sets",
] as const;

// Source: https://universaldependencies.org/u/feat/NumType.html
export const NumType = z.enum(numTypeValues);
export type NumType = z.infer<typeof NumType>;

const reprForNumType = {
	Card: "cardinal number or corresponding interrogative / relative / indefinite / demonstrative word",
	Dist: "distributive numeral",
	Frac: "fraction",
	Mult: "multiplicative numeral or corresponding interrogative / relative / indefinite / demonstrative word",
	Ord: "ordinal number or corresponding interrogative / relative / indefinite / demonstrative word",
	Range: "range of values",
	Sets: "number of sets of things; collective numeral",
} satisfies Record<NumType, string>;

export function getReprForNumType(numType: NumType) {
	return reprForNumType[numType];
}
