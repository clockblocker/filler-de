import z from "zod/v3";

const phrasemeKinds = [
	"Idiom", // non-literal, fixed expression (e.g. "kick the bucket"). The meaning of the whole cannot be inferred from its parts
	"Collocation", // productive template with open slot (e.g. "[modifier] + reasons")
	"DiscourseFormula", // fixed social routines (e.g. "thank you", "excuse me")
	"Proverb", // full-sentence folk wisdom (e.g. "A stitch in time saves nine")
	"CulturalQuotation", // well-known literary or public quotes (e.g. "To be or not to be")
] as const;

export const PhrasemeKindSchema = z.enum(phrasemeKinds);

export type PhrasemeKind = z.infer<typeof PhrasemeKindSchema>;
export const PhrasemeKind = PhrasemeKindSchema.enum;
export const PHRASEM_KINDS = PhrasemeKindSchema.options;
