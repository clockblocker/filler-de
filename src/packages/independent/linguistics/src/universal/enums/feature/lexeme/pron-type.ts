import { z } from "zod/v3";

const pronTypeValues = [
	"Art",
	"Dem",
	"Emp",
	"Exc",
	"Ind",
	"Int",
	"Neg",
	"Prs",
	"Rcp",
	"Rel",
	"Tot",
] as const;

// Source: https://universaldependencies.org/u/feat/PronType.html
export const PronType = z.enum(pronTypeValues);
export type PronType = z.infer<typeof PronType>;
export const PRON_TYPE_KEY = "pronType";

const reprForPronType = {
	Art: "article",
	Dem: "demonstrative",
	Emp: "emphatic",
	Exc: "exclamative",
	Ind: "indefinite",
	Int: "interrogative",
	Neg: "negative",
	Prs: "personal",
	Rcp: "reciprocal",
	Rel: "relative",
	Tot: "total",
} satisfies Record<PronType, string>;

export function getReprForPronType(pronType: PronType) {
	return reprForPronType[pronType];
}
