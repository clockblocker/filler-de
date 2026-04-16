import { z } from "zod/v3";

const openClassPosValues = [
	"ADJ",
	"ADV",
	"INTJ",
	"NOUN",
	"PROPN",
	"VERB",
] as const;

const closedClassPosValues = [
	"ADP",
	"AUX",
	"CCONJ",
	"DET",
	"NUM",
	"PART",
	"PRON",
	"SCONJ",
] as const;

const otherPosValues = ["PUNCT", "SYM", "X"] as const;
const POS_VALUES = [
	...openClassPosValues,
	...closedClassPosValues,
	...otherPosValues,
] as const;

const OpenClassPos = z.enum(openClassPosValues);
type OpenClassPos = z.infer<typeof OpenClassPos>;

const ClosedClassPos = z.enum(closedClassPosValues);
type ClosedClassPos = z.infer<typeof ClosedClassPos>;

const OtherPos = z.enum(otherPosValues);
type OtherPos = z.infer<typeof OtherPos>;

// Source: https://universaldependencies.org/u/pos/index.html
export const Pos = z.enum(POS_VALUES);
export type Pos = z.infer<typeof Pos>;

const reprForPos = {
	ADJ: "adjective",
	ADP: "adposition",
	ADV: "adverb",
	AUX: "auxiliary",
	CCONJ: "coordinating conjunction",
	DET: "determiner",
	INTJ: "interjection",
	NOUN: "noun",
	NUM: "numeral",
	PART: "particle",
	PRON: "pronoun",
	PROPN: "proper noun",
	PUNCT: "punctuation",
	SCONJ: "subordinating conjunction",
	SYM: "symbol",
	VERB: "verb",
	X: "other",
} satisfies Record<Pos, string>;

function getReprForPos(pos: Pos) {
	return reprForPos[pos];
}
