import z from 'zod/v4';

const NounTagSchema = z.literal('NOUN');
export type NounTag = z.infer<typeof NounTagSchema>;
export const NOUN_TAG = NounTagSchema.value;

const PronounTagSchema = z.literal('PRON');
export type PronounTag = z.infer<typeof PronounTagSchema>;
export const PRONOUN_TAG = PronounTagSchema.value;

const ArticleTagSchema = z.literal('ART');
export type ArticleTag = z.infer<typeof ArticleTagSchema>;
export const ARTICLE_TAG = ArticleTagSchema.value;

const AdjectiveTagSchema = z.literal('ADJ');
export type AdjectiveTag = z.infer<typeof AdjectiveTagSchema>;
export const ADJECTIVE_TAG = AdjectiveTagSchema.value;

const VerbTagSchema = z.literal('VERB');
export type VerbTag = z.infer<typeof VerbTagSchema>;
export const VERB_TAG = VerbTagSchema.value;

const PrepositionTagSchema = z.literal('PREP');
export type PrepositionTag = z.infer<typeof PrepositionTagSchema>;
export const PREPOSITION_TAG = PrepositionTagSchema.value;

const AdverbTagSchema = z.literal('ADV');
export type AdverbTag = z.infer<typeof AdverbTagSchema>;
export const ADVERB_TAG = AdverbTagSchema.value;

const ParticleTagSchema = z.literal('PART');
export type ParticleTag = z.infer<typeof ParticleTagSchema>;
export const PARTICLE_TAG = ParticleTagSchema.value;

const ConjunctionTagSchema = z.literal('KON');
export type ConjunctionTag = z.infer<typeof ConjunctionTagSchema>;
export const CONJUNCTION_TAG = ConjunctionTagSchema.value;

const InteractionalUnitTagSchema = z.literal('IU');
export type InteractionalUnitTag = z.infer<typeof InteractionalUnitTagSchema>;
export const INTERACTIONAL_UNIT_TAG = InteractionalUnitTagSchema.value;

export const PosTagSchema = z.union([
	NounTagSchema,
	PronounTagSchema,
	ArticleTagSchema,
	AdjectiveTagSchema,
	VerbTagSchema,
	PrepositionTagSchema,
	AdverbTagSchema,
	ParticleTagSchema,
	ConjunctionTagSchema,
	InteractionalUnitTagSchema,
]);

export type PosTag = z.infer<typeof PosTagSchema>;
