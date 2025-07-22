import { z } from 'zod';

const LING_NOTE_STR_TYPES = [
	'Phrasem',
	'Lexem',
	'Morphem',
	'Inflection',
] as const;

const META_NOTE_STR_TYPES = ['Navigation', 'Grammar', 'Unknown'] as const;

export const LingNoteTypeSchema = z.enum(LING_NOTE_STR_TYPES);
export const MetaNoteTypeSchema = z.enum(META_NOTE_STR_TYPES);
export const NoteTypeSchema = z.enum([
	...LING_NOTE_STR_TYPES,
	...META_NOTE_STR_TYPES,
]);

export type LingNoteType = z.infer<typeof LingNoteTypeSchema>;
export const LingNoteType = LingNoteTypeSchema.enum;
export const LING_NOTE_TYPES = LingNoteTypeSchema.options;

export const MetaNoteType = MetaNoteTypeSchema.enum;
export type MetaNoteType = z.infer<typeof MetaNoteTypeSchema>;
export const META_NOTE_TYPES = MetaNoteTypeSchema.options;

export type NoteType = z.infer<typeof NoteTypeSchema>;
export const NoteType = NoteTypeSchema.enum;
export const NOTE_TYPES = NoteTypeSchema.options;
