import z from 'zod/v4';

const PARTS_OF_SPEECH_STR = [
	'Noun', // [Nomen] – lexical noun, incl. count/mass, common/proper
	'Pronoun', // [Pronomen] – includes personal, reflexive, demonstrative, etc.
	'Article', // [Artikel] – definite/indefinite/possessive/etc.
	'Adjective', // [Adjektiv] – attributive or predicative
	'Verb', // [Verb] – includes full, modal, auxiliary
	'Preposition', // [Präposition] – links phrases via case
	'Adverb', // [Adverb] – modifies verbs, adjectives, clauses
	'Particle', // [Partikel] – modal, focus, negation, etc.
	'Conjunction', // [Junktor] – coordinating, subordinating, etc.
	'InteractionalUnit', // [[interaktive Einheit]] – interjections, response tokens, vocatives, etc.
] as const;

export const PartOfSpeechSchema = z.enum(PARTS_OF_SPEECH_STR);

export type PartOfSpeech = z.infer<typeof PartOfSpeechSchema>;
export const PartOfSpeech = PartOfSpeechSchema.enum;
export const PARTS_OF_SPEECH = PartOfSpeechSchema.options;

