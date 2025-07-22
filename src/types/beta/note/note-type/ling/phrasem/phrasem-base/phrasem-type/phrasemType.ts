import z from 'zod/v4';

const PHRASEM_TYPES_STR = [
	'Idiom', // non-literal, fixed expression (e.g. "kick the bucket"). The meaning of the whole cannot be inferred from its parts
	'Collocation', // productive template with open slot (e.g. "[modifier] + reasons")
	'DiscourseFormula', // fixed social routines (e.g. "thank you", "excuse me")
	'Proverb', // full-sentence folk wisdom (e.g. "A stitch in time saves nine")
	'CulturalQuotation', // well-known literary or public quotes (e.g. "To be or not to be")
] as const;

export const PhrasemeTypeSchema = z.enum(PHRASEM_TYPES_STR);

export type PhrasemeType = z.infer<typeof PhrasemeTypeSchema>;
export const PhrasemeType = PhrasemeTypeSchema.enum;
export const PHRASEM_TYPES = PhrasemeTypeSchema.options;

