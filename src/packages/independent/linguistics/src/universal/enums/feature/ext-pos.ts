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

const extPosRepr = {
	ADJ: "adjective-like expression",
	ADP: "adposition-like expression",
	ADV: "adverb-like expression",
	AUX: "auxiliary-like expression",
	CCONJ: "coordinating conjunction-like expression",
	DET: "determiner-like expression",
	INTJ: "interjection-like expression",
	PRON: "pronoun-like expression",
	PROPN: "proper noun-like expression",
	SCONJ: "subordinator-like expression",
} satisfies Record<ExtPos, string>;

export function reprForExtPos(extPos: ExtPos) {
	return extPosRepr[extPos];
}
