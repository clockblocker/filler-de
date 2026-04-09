import { z } from "zod/v3";

const numberValues = [
	"Coll",
	"Count",
	"Dual",
	"Grpa",
	"Grpl",
	"Inv",
	"Pauc",
	"Plur",
	"Ptan",
	"Sing",
	"Tri",
] as const;

// Source: https://universaldependencies.org/u/feat/Number.html
export const GrammaticalNumber = z.enum(numberValues);
export type GrammaticalNumber = z.infer<typeof GrammaticalNumber>;

const reprForNumber = {
	Coll: "collective / mass / singulare tantum",
	Count: "count plural",
	Dual: "dual number",
	Grpa: "greater paucal number",
	Grpl: "greater plural number",
	Inv: "inverse number",
	Pauc: "paucal number",
	Plur: "plural number",
	Ptan: "plurale tantum",
	Sing: "singular number",
	Tri: "trial number",
} satisfies Record<GrammaticalNumber, string>;

export function getReprForNumber(number: GrammaticalNumber) {
	return reprForNumber[number];
}
