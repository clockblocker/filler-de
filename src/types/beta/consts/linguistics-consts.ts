import z from 'zod/v4';

// Format
const PlusDelimeterSchema = z.literal('_plus_');
export type PlusDelimeter = z.infer<typeof PlusDelimeterSchema>;
export const PLUS_DELIMETER = PlusDelimeterSchema.value;

// Morphems

export const ROOT = 'Root';
export const PREFIX = 'Prefix';
export const SUFFIX = 'Suffix';
export const INFIX = 'Infix';
export const CIRCUMFIX = 'Circumfix';
export const LINKING_ELEMENT = 'LinkingElement';

export const MORPHEME_TYPES_STR = [
	ROOT, // core lexical base (e.g. "book", "write")
	PREFIX, // attaches before the root (e.g. "un-", "re-")
	SUFFIX, // attaches after the root (e.g. "-ness", "-able")
	INFIX, // inserted within the root (e.g. Tagalog "-um-")
	CIRCUMFIX, // wraps around the root (e.g. German "ge-...-t")
	LINKING_ELEMENT, // joins compound parts (e.g. "Arbeitszeit", "Liebeserklärung")
] as const;

export const MorphemeTypeSchema = z.enum(MORPHEME_TYPES_STR);

export type MorphemeType = z.infer<typeof MorphemeTypeSchema>;
export const MorphemeType = MorphemeTypeSchema.enum;
export const MORPHEME_TYPES = MorphemeTypeSchema.options;

// Linguistic units
export const PhrasemSchema = z.literal('Phrasem');
export type Phrasem = z.infer<typeof PhrasemSchema>;
export const PHRASEM = PhrasemSchema.value;

export const LexemSchema = z.literal('Lexem');
export type Lexem = z.infer<typeof LexemSchema>;
export const LEXEM = LexemSchema.value;

export const MorphemSchema = z.literal('Morphem');
export type Morphem = z.infer<typeof MorphemSchema>;
export const MORPHEM = MorphemSchema.value;

export const InflectionSchema = z.literal('Inflection');
export type Inflection = z.infer<typeof InflectionSchema>;
export const INFLECTION = InflectionSchema.value;

export const LINGUISTIC_UNIT_STR_TYPES = [
	PHRASEM,
	LEXEM,
	MORPHEM,
	INFLECTION,
] as const;

export const LinguisticUnitTypeSchema = z.enum(LINGUISTIC_UNIT_STR_TYPES);
export type LinguisticUnitType = z.infer<typeof LinguisticUnitTypeSchema>;
export const LinguisticUnitType = LinguisticUnitTypeSchema.enum;
export const LINGUISTIC_UNIT_TYPES = LinguisticUnitTypeSchema.options;

// Parts of Speech

export const NounSchema = z.literal('Noun');
export type Noun = z.infer<typeof NounSchema>;
export const NOUN = NounSchema.value;

export const PronounSchema = z.literal('Pronoun');
export type Pronoun = z.infer<typeof PronounSchema>;
export const PRONOUN = PronounSchema.value;

export const ArticleSchema = z.literal('Article');
export type Article = z.infer<typeof ArticleSchema>;
export const ARTICLE = ArticleSchema.value;

export const AdjectiveSchema = z.literal('Adjective');
export type Adjective = z.infer<typeof AdjectiveSchema>;
export const ADJECTIVE = AdjectiveSchema.value;

export const VerbSchema = z.literal('Verb');
export type Verb = z.infer<typeof VerbSchema>;
export const VERB = VerbSchema.value;

export const PrepositionSchema = z.literal('Preposition');
export type Preposition = z.infer<typeof PrepositionSchema>;
export const PREPOSITION = PrepositionSchema.value;

export const AdverbSchema = z.literal('Adverb');
export type Adverb = z.infer<typeof AdverbSchema>;
export const ADVERB = AdverbSchema.value;

export const ParticleSchema = z.literal('Particle');
export type Particle = z.infer<typeof ParticleSchema>;
export const PARTICLE = ParticleSchema.value;

export const ConjunctionSchema = z.literal('Conjunction');
export type Conjunction = z.infer<typeof ConjunctionSchema>;
export const CONJUNCTION = ConjunctionSchema.value;

export const InteractionalUnitSchema = z.literal('InteractionalUnit');
export type InteractionalUnit = z.infer<typeof InteractionalUnitSchema>;
export const INTERACTIONAL_UNIT = InteractionalUnitSchema.value;

export const PARTS_OF_SPEECH_STR = [
	NOUN, // [Nomen] – lexical noun, incl. count/mass, common/proper
	PRONOUN, // [Pronomen] – includes personal, reflexive, demonstrative, etc.
	ARTICLE, // [Artikel] – definite/indefinite/possessive/etc.
	ADJECTIVE, // [Adjektiv] – attributive or predicative
	VERB, // [Verb] – includes full, modal, auxiliary
	PREPOSITION, // [Präposition] – links phrases via case
	ADVERB, // [Adverb] – modifies verbs, adjectives, clauses
	PARTICLE, // [Partikel] – modal, focus, negation, etc.
	CONJUNCTION, // [Junktor] – coordinating, subordinating, etc.
	INTERACTIONAL_UNIT, // [[interaktive Einheit]] – interjections, response tokens, vocatives, etc.
] as const;

export const PartOfSpeechSchema = z.enum(PARTS_OF_SPEECH_STR);

export type PartOfSpeech = z.infer<typeof PartOfSpeechSchema>;
export const PartOfSpeech = PartOfSpeechSchema.enum;
export const PARTS_OF_SPEECH = PartOfSpeechSchema.options;

// Parts of Speech/Tags

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

export const POS_TAGS_STR = [
	NOUN_TAG, // [Nomen]
	PRONOUN_TAG, // [Pronomen]
	ARTICLE_TAG, // [Artikel]
	ADJECTIVE_TAG, // [Adjektiv]
	VERB_TAG, // [Verb]
	PREPOSITION_TAG, // [Präposition]
	ADVERB_TAG, // [Adverb]
	PARTICLE_TAG, // [Partikel]
	CONJUNCTION_TAG, // [Junktor]
	INTERACTIONAL_UNIT_TAG, // [[interaktive Einheit]]
] as const;

export const PosTagSchema = z.enum(POS_TAGS_STR);
export type PosTag = z.infer<typeof PosTagSchema>;
export const PosTag = PosTagSchema.enum;
export const POS_TAGS = PosTagSchema.options;

export const posTagFormFromPos: Record<PartOfSpeech, PosTag> = {
	[PartOfSpeech.Noun]: NOUN_TAG,
	[PartOfSpeech.Pronoun]: PRONOUN_TAG,
	[PartOfSpeech.Article]: ARTICLE_TAG,
	[PartOfSpeech.Adjective]: ADJECTIVE_TAG,
	[PartOfSpeech.Verb]: VERB_TAG,
	[PartOfSpeech.Preposition]: PREPOSITION_TAG,
	[PartOfSpeech.Adverb]: ADVERB_TAG,
	[PartOfSpeech.Particle]: PARTICLE_TAG,
	[PartOfSpeech.Conjunction]: CONJUNCTION_TAG,
	[PartOfSpeech.InteractionalUnit]: INTERACTIONAL_UNIT_TAG,
} as const;

export const posFormFromPosTag: Record<PosTag, PartOfSpeech> = {
	[NOUN_TAG]: PartOfSpeech.Noun,
	[PRONOUN_TAG]: PartOfSpeech.Pronoun,
	[ARTICLE_TAG]: PartOfSpeech.Article,
	[ADJECTIVE_TAG]: PartOfSpeech.Adjective,
	[VERB_TAG]: PartOfSpeech.Verb,
	[PREPOSITION_TAG]: PartOfSpeech.Preposition,
	[ADVERB_TAG]: PartOfSpeech.Adverb,
	[PARTICLE_TAG]: PartOfSpeech.Particle,
	[CONJUNCTION_TAG]: PartOfSpeech.Conjunction,
	[INTERACTIONAL_UNIT_TAG]: PartOfSpeech.InteractionalUnit,
} as const;

// Phrasems/

export const IDIOM = 'Idiom';
export const COLLOCATION = 'Collocation';
export const DISCOURSE_FORMULA = 'DiscourseFormula';
export const PROVERB = 'Proverb';
export const CULTURAL_QUOTATION = 'CulturalQuotation';

export const PHRASEM_TYPES_STR = [
	IDIOM, // non-literal, fixed expression (e.g. "kick the bucket"). The meaning of the whole cannot be inferred from its parts
	COLLOCATION, // productive template with open slot (e.g. "[modifier] + reasons")
	DISCOURSE_FORMULA, // fixed social routines (e.g. "thank you", "excuse me")
	PROVERB, // full-sentence folk wisdom (e.g. "A stitch in time saves nine")
	CULTURAL_QUOTATION, // well-known literary or public quotes (e.g. "To be or not to be")
] as const;

export const PhrasemeTypeSchema = z.enum(PHRASEM_TYPES_STR);

export type PhrasemeType = z.infer<typeof PhrasemeTypeSchema>;
export const PhrasemeType = PhrasemeTypeSchema.enum;
export const PHRASEM_TYPES = PhrasemeTypeSchema.options;

// Phrasems/DefinedDiscourseFormula/Role

export const GREETING = 'Greeting';
export const FAREWELL = 'Farewell';
export const APOLOGY = 'Apology';
export const THANKS = 'Thanks';
export const ACKNOWLEDGMENT = 'Acknowledgment';
export const REFUSAL = 'Refusal';
export const REQUEST = 'Request';
export const REACTION = 'Reaction';
export const INITIATION = 'Initiation';
export const TRANSITION = 'Transition';

export const DEFINED_DISCOURSE_FORMULA_ROLES_STR = [
	GREETING,
	FAREWELL,
	APOLOGY,
	THANKS,
	ACKNOWLEDGMENT,
	REFUSAL,
	REQUEST,
	REACTION,
	INITIATION,
	TRANSITION,
] as const;

export const DefinedDiscourseFormulaRoleSchema = z.enum(
	DEFINED_DISCOURSE_FORMULA_ROLES_STR
);

export type DefinedDiscourseFormulaRole = z.infer<
	typeof DefinedDiscourseFormulaRoleSchema
>;
export const DefinedDiscourseFormulaRole =
	DefinedDiscourseFormulaRoleSchema.enum;

export const DEFINED_DISCOURSE_FORMULA_ROLES =
	DefinedDiscourseFormulaRoleSchema.options;

export const DiscourseFormulaRoleSchema = DefinedDiscourseFormulaRoleSchema.or(
	z.string()
);

export type DiscourseFormulaRole = z.infer<typeof DiscourseFormulaRoleSchema>;

// Phrasems/Collocation/Strength

export const FREE = 'Free'; // fully compositional and flexible combinations (e.g. "red car")
export const BOUND = 'Bound'; // statistically preferred, semi-fixed phrases (e.g. "make a decision")
export const FROZEN = 'Frozen'; // lexically fixed expressions with limited or no variation (e.g. "kick the bucket")

export const COLLOCATION_STRENGTH_STR = [FREE, BOUND, FROZEN] as const;

export const CollocationStrengthSchema = z.enum(COLLOCATION_STRENGTH_STR);

export type CollocationStrength = z.infer<typeof CollocationStrengthSchema>;
export const CollocationStrength = CollocationStrengthSchema.enum;
export const COLLOCATION_STRENGTHS = CollocationStrengthSchema.options;

// Phrasems/Collocation/Type

const COLLOCATION_TYPES_STR = [
	`${PosTag.ADJ}${PLUS_DELIMETER}${PosTag.NOUN}`, // ADJ_plus_NOUN e.g. "strong tea", "deep sleep"
	`${PosTag.NOUN}${PLUS_DELIMETER}${PosTag.NOUN}`, // NOUN_plus_NOUN e.g. "chicken soup", "data center"
	`${PosTag.NOUN}${PLUS_DELIMETER}${PosTag.VERB}`, // NOUN_plus_VERB e.g. "dogs bark", "alarms ring"
	`${PosTag.VERB}${PLUS_DELIMETER}${PosTag.NOUN}`, // VERB_plus_NOUN e.g. "make a decision", "catch a cold"
	`${PosTag.ADV}${PLUS_DELIMETER}${PosTag.ADJ}`, // ADV_plus_ADJ e.g. "deeply sorry", "highly unlikely"
	`${PosTag.VERB}${PLUS_DELIMETER}${PosTag.PREP}`, // VERB_plus_PREP (Verb plus PREPositional phrase) e.g. "depend on", "look into"
	`${PosTag.VERB}${PLUS_DELIMETER}${PosTag.ADV}`, // VERB_plus_ADV e.g. "speak loudly", "run fast"
] as const;

export const CollocationTypeSchema = z.enum(COLLOCATION_TYPES_STR);

export type CollocationType = z.infer<typeof CollocationTypeSchema>;
export const CollocationType = CollocationTypeSchema.enum;
export const COLLOCATION_TYPES = CollocationTypeSchema.options;

// STYLISTIC

const STYLISTIC_TONE_STR = [
	'Neutral', // default, unmarked
	'Casual', // relaxed, friendly tone
	'Colloquial', // informal, everyday speech
	'Marked', // emotionally loaded or stylistically salient
	'Formal', // elevated, institutional, academic
	'Vulgar', // socially inappropriate, low register
	'TabooProne', // context-sensitive, bordering on offensive
	'Poetic', // literary, metaphor-rich, stylistically rare
] as const;


// aspectual class Punctual / Telic
// participant roles: Agent, Patient
// possible frame elements: Instrument, BodyPart, Manner

// semantic primitives
// anfassen(x, y) ≈ cause(x, contact(touch(x, y)))

// Aspekts
// - Auxiliary verb
// - 







// anfassen
// substitute
// nuance
// berühren
// more formal, neutral
// technical, emotional detachment
// anlangen
// old-fashioned / poetic
// regional/dialectal
// grapschen
// vulgar / negative
// implies impropriety or crudeness
// thematisieren
// metaphorical contexts
// abstracted, formal speech
