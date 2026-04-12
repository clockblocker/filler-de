import { z } from "zod/v3";
import type { TargetLanguage } from "../../../types";

export const TARGET_LANGUAGE_CODE: Record<TargetLanguage, string> = {
	English: "en",
	German: "de",
};

const noteUnitKinds = ["Lexeme", "Phraseme", "Morpheme"] as const;

export const LinguisticUnitKindSchema = z.enum(noteUnitKinds);
export type LinguisticUnitKind = z.infer<typeof LinguisticUnitKindSchema>;
export const LinguisticUnitKind = LinguisticUnitKindSchema.enum;
export const LINGUISTIC_UNIT_KINDS = LinguisticUnitKindSchema.options;

const noteSurfaceKinds = ["Lemma", "Inflection", "Variant", "Partial"] as const;

export const SurfaceKindSchema = z.enum(noteSurfaceKinds);
export type SurfaceKind = z.infer<typeof SurfaceKindSchema>;
export const SurfaceKind = SurfaceKindSchema.enum;
export const SURFACE_KINDS = SurfaceKindSchema.options;

const partsOfSpeech = [
	"ADJ",
	"ADP",
	"ADV",
	"AUX",
	"CCONJ",
	"DET",
	"INTJ",
	"NOUN",
	"NUM",
	"PART",
	"PRON",
	"PROPN",
	"PUNCT",
	"SCONJ",
	"SYM",
	"VERB",
	"X",
] as const;

export const POSSchema = z.enum(partsOfSpeech);
export type POS = z.infer<typeof POSSchema>;
export const POS = POSSchema.enum;
export const PARTS_OF_SPEECH = POSSchema.options;

const posTags = partsOfSpeech;

export const PosTagSchema = z.enum(posTags);
export type PosTag = z.infer<typeof PosTagSchema>;
export const PosTag = PosTagSchema.enum;
export const POS_TAGS = PosTagSchema.options;

export const posTagFormFromPos: Record<POS, PosTag> = {
	[POS.ADJ]: PosTag.ADJ,
	[POS.ADP]: PosTag.ADP,
	[POS.ADV]: PosTag.ADV,
	[POS.AUX]: PosTag.AUX,
	[POS.CCONJ]: PosTag.CCONJ,
	[POS.DET]: PosTag.DET,
	[POS.INTJ]: PosTag.INTJ,
	[POS.NOUN]: PosTag.NOUN,
	[POS.NUM]: PosTag.NUM,
	[POS.PART]: PosTag.PART,
	[POS.PRON]: PosTag.PRON,
	[POS.PROPN]: PosTag.PROPN,
	[POS.PUNCT]: PosTag.PUNCT,
	[POS.SCONJ]: PosTag.SCONJ,
	[POS.SYM]: PosTag.SYM,
	[POS.VERB]: PosTag.VERB,
	[POS.X]: PosTag.X,
};

export const posFormFromPosTag: Record<PosTag, POS> = {
	[PosTag.ADJ]: POS.ADJ,
	[PosTag.ADP]: POS.ADP,
	[PosTag.ADV]: POS.ADV,
	[PosTag.AUX]: POS.AUX,
	[PosTag.CCONJ]: POS.CCONJ,
	[PosTag.DET]: POS.DET,
	[PosTag.INTJ]: POS.INTJ,
	[PosTag.NOUN]: POS.NOUN,
	[PosTag.NUM]: POS.NUM,
	[PosTag.PART]: POS.PART,
	[PosTag.PRON]: POS.PRON,
	[PosTag.PROPN]: POS.PROPN,
	[PosTag.PUNCT]: POS.PUNCT,
	[PosTag.SCONJ]: POS.SCONJ,
	[PosTag.SYM]: POS.SYM,
	[PosTag.VERB]: POS.VERB,
	[PosTag.X]: POS.X,
};
