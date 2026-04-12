import { z } from "zod/v3";
import type { TargetLanguage } from "../../../types";

export const TARGET_LANGUAGE_CODE: Record<TargetLanguage, string> = {
	English: "en",
	German: "de",
};

const noteUnitKinds = ["Lexem", "Phrasem", "Morphem"] as const;

export const LinguisticUnitKindSchema = z.enum(noteUnitKinds);
export type LinguisticUnitKind = z.infer<typeof LinguisticUnitKindSchema>;
export const LinguisticUnitKind = LinguisticUnitKindSchema.enum;
export const LINGUISTIC_UNIT_KINDS = LinguisticUnitKindSchema.options;

const noteSurfaceKinds = ["Lemma", "Inflected", "Variant", "Partial"] as const;

export const SurfaceKindSchema = z.enum(noteSurfaceKinds);
export type SurfaceKind = z.infer<typeof SurfaceKindSchema>;
export const SurfaceKind = SurfaceKindSchema.enum;
export const SURFACE_KINDS = SurfaceKindSchema.options;

const partsOfSpeech = [
	"Noun",
	"Pronoun",
	"Article",
	"Adjective",
	"Verb",
	"Preposition",
	"Adverb",
	"Particle",
	"Conjunction",
	"InteractionalUnit",
] as const;

export const POSSchema = z.enum(partsOfSpeech);
export type POS = z.infer<typeof POSSchema>;
export const POS = POSSchema.enum;
export const PARTS_OF_SPEECH = POSSchema.options;

const posTags = [
	"NOUN",
	"PRON",
	"ART",
	"ADJ",
	"VERB",
	"PREP",
	"ADV",
	"PART",
	"KON",
	"IU",
] as const;

export const PosTagSchema = z.enum(posTags);
export type PosTag = z.infer<typeof PosTagSchema>;
export const PosTag = PosTagSchema.enum;
export const POS_TAGS = PosTagSchema.options;

export const posTagFormFromPos: Record<POS, PosTag> = {
	[POS.Noun]: PosTag.NOUN,
	[POS.Pronoun]: PosTag.PRON,
	[POS.Article]: PosTag.ART,
	[POS.Adjective]: PosTag.ADJ,
	[POS.Verb]: PosTag.VERB,
	[POS.Preposition]: PosTag.PREP,
	[POS.Adverb]: PosTag.ADV,
	[POS.Particle]: PosTag.PART,
	[POS.Conjunction]: PosTag.KON,
	[POS.InteractionalUnit]: PosTag.IU,
};

export const posFormFromPosTag: Record<PosTag, POS> = {
	[PosTag.NOUN]: POS.Noun,
	[PosTag.PRON]: POS.Pronoun,
	[PosTag.ART]: POS.Article,
	[PosTag.ADJ]: POS.Adjective,
	[PosTag.VERB]: POS.Verb,
	[PosTag.PREP]: POS.Preposition,
	[PosTag.ADV]: POS.Adverb,
	[PosTag.PART]: POS.Particle,
	[PosTag.KON]: POS.Conjunction,
	[PosTag.IU]: POS.InteractionalUnit,
};
