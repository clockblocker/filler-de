import { z } from "zod/v3";

const extPosValues = [
	"ADJ",
	"ADP",
	"ADV",
	"AUX",
	"CCONJ",
	"DET",
	"INTJ",
	"PRON",
	"PROPN",
	"SCONJ",
] as const;

// Source: https://universaldependencies.org/u/feat/ExtPos.html
export const ExtPos = z.enum(extPosValues);
export type ExtPos = z.infer<typeof ExtPos>;

const reprForExtPos = {
	ADJ: "adjective-like",
	ADP: "adposition-like",
	ADV: "adverb-like",
	AUX: "auxiliary-like",
	CCONJ: "coordinating conjunction-like",
	DET: "determiner-like",
	INTJ: "interjection-like",
	PRON: "pronoun-like",
	PROPN: "proper noun-like",
	SCONJ: "subordinator-like",
} satisfies Record<ExtPos, string>;

function getReprForExtPos(extPos: ExtPos) {
	return reprForExtPos[extPos];
}
