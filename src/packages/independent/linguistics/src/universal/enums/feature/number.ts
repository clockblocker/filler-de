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
export const Number = z.enum(numberValues);
export type Number = z.infer<typeof Number>;

const numberRepr = {
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
} satisfies Record<Number, string>;

export function reprForNumber(number: Number) {
	return numberRepr[number];
}
