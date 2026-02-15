import z from "zod";

export const PARTS_OF_SPEECH_STR = [
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

export const POSSchema = z.enum(PARTS_OF_SPEECH_STR);

export type POS = z.infer<typeof POSSchema>;
export const POS = POSSchema.enum;
export const PARTS_OF_SPEECH = POSSchema.options;

export const POS_TAGS_STR = [
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

export const PosTagSchema = z.enum(POS_TAGS_STR);
export type PosTag = z.infer<typeof PosTagSchema>;
export const PosTag = PosTagSchema.enum;
export const POS_TAGS = PosTagSchema.options;

// -- Maps --

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
} as const satisfies Record<POS, PosTag>;

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
} as const satisfies Record<PosTag, POS>;
