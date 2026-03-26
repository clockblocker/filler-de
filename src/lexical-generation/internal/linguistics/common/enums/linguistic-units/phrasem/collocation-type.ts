import z from "zod/v3";

const collocationTypes = [
	"AdjectiveNoun",
	"NounNoun",
	"NounVerb",
	"VerbNoun",
	"AdverbAdjective",
	"VerbAdverb",
	"PrepositionPhrase",
] as const;

export const CollocationTypeSchema = z.enum(collocationTypes);

export type CollocationType = z.infer<typeof CollocationTypeSchema>;
export const CollocationType = CollocationTypeSchema.enum;
export const COLLOCATION_TYPES = CollocationTypeSchema.options;
