import z from 'zod/v4';

// Format
const PlusDelimeterSchema = z.literal('_plus_');
export type PLUS_DELIMETER = z.infer<typeof PlusDelimeterSchema>;
export const PLUS_DELIMETER = PlusDelimeterSchema.value;

// Morphems

export const RootLiteralSchema = z.literal('Root');
export type ROOT = z.infer<typeof RootLiteralSchema>;
export const ROOT = RootLiteralSchema.value;

export const PrefixLiteralSchema = z.literal('Prefix');
export type PREFIX = z.infer<typeof PrefixLiteralSchema>;
export const PREFIX = PrefixLiteralSchema.value;

export const SuffixLiteralSchema = z.literal('Suffix');
export type SUFFIX = z.infer<typeof SuffixLiteralSchema>;
export const SUFFIX = SuffixLiteralSchema.value;

export const InfixLiteralSchema = z.literal('Infix');
export type INFIX = z.infer<typeof InfixLiteralSchema>;
export const INFIX = InfixLiteralSchema.value;

export const CircumfixLiteralSchema = z.literal('Circumfix');
export type CIRCUMFIX = z.infer<typeof CircumfixLiteralSchema>;
export const CIRCUMFIX = CircumfixLiteralSchema.value;

export const LinkingElementLiteralSchema = z.literal('LinkingElement');
export type LINKING_ELEMENT = z.infer<typeof LinkingElementLiteralSchema>;
export const LINKING_ELEMENT = LinkingElementLiteralSchema.value;

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

export const PhrasemLiteralSchema = z.literal('Phrasem');
export type PHRASEM = z.infer<typeof PhrasemLiteralSchema>;
export const PHRASEM = PhrasemLiteralSchema.value;

export const LexemLiteralSchema = z.literal('Lexem');
export type LEXEM = z.infer<typeof LexemLiteralSchema>;
export const LEXEM = LexemLiteralSchema.value;

export const MorphemLiteralSchema = z.literal('Morphem');
export type MORPHEM = z.infer<typeof MorphemLiteralSchema>;
export const MORPHEM = MorphemLiteralSchema.value;

export const InflectionLiteralSchema = z.literal('Inflection');
export type INFLECTION = z.infer<typeof InflectionLiteralSchema>;
export const INFLECTION = InflectionLiteralSchema.value;

export const LINGUISTIC_UNIT_STR_TYPES = [
	PHRASEM,
	LEXEM,
	MORPHEM,
	INFLECTION,
] as const;

export const LinguisticUnitSchema = z.enum(LINGUISTIC_UNIT_STR_TYPES);
export type LinguisticUnit = z.infer<typeof LinguisticUnitSchema>;
export const LinguisticUnit = LinguisticUnitSchema.enum;
export const LINGUISTIC_UNITS = LinguisticUnitSchema.options;

// Parts of Speech

export const NounLiteralSchema = z.literal('Noun');
export type NOUN = z.infer<typeof NounLiteralSchema>;
export const NOUN = NounLiteralSchema.value;

export const PronounLiteralSchema = z.literal('Pronoun');
export type PRONOUN = z.infer<typeof PronounLiteralSchema>;
export const PRONOUN = PronounLiteralSchema.value;

export const ArticleLiteralSchema = z.literal('Article');
export type ARTICLE = z.infer<typeof ArticleLiteralSchema>;
export const ARTICLE = ArticleLiteralSchema.value;

export const AdjectiveLiteralSchema = z.literal('Adjective');
export type ADJECTIVE = z.infer<typeof AdjectiveLiteralSchema>;
export const ADJECTIVE = AdjectiveLiteralSchema.value;

export const VerbLiteralSchema = z.literal('Verb');
export type VERB = z.infer<typeof VerbLiteralSchema>;
export const VERB = VerbLiteralSchema.value;

export const PrepositionLiteralSchema = z.literal('Preposition');
export type PREPOSITION = z.infer<typeof PrepositionLiteralSchema>;
export const PREPOSITION = PrepositionLiteralSchema.value;

export const AdverbLiteralSchema = z.literal('Adverb');
export type ADVERB = z.infer<typeof AdverbLiteralSchema>;
export const ADVERB = AdverbLiteralSchema.value;

export const ParticleLiteralSchema = z.literal('Particle');
export type PARTICLE = z.infer<typeof ParticleLiteralSchema>;
export const PARTICLE = ParticleLiteralSchema.value;

export const ConjunctionLiteralSchema = z.literal('Conjunction');
export type CONJUNCTION = z.infer<typeof ConjunctionLiteralSchema>;
export const CONJUNCTION = ConjunctionLiteralSchema.value;

export const InteractionalUnitLiteralSchema = z.literal('InteractionalUnit');
export type INTERACTIONAL_UNIT = z.infer<typeof InteractionalUnitLiteralSchema>;
export const INTERACTIONAL_UNIT = InteractionalUnitLiteralSchema.value;

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
export type NOUN_TAG = z.infer<typeof NounTagSchema>;
export const NOUN_TAG = NounTagSchema.value;

const PronounTagSchema = z.literal('PRON');
export type PRONOUN_TAG = z.infer<typeof PronounTagSchema>;
export const PRONOUN_TAG = PronounTagSchema.value;

const ArticleTagSchema = z.literal('ART');
export type ARTICLE_TAG = z.infer<typeof ArticleTagSchema>;
export const ARTICLE_TAG = ArticleTagSchema.value;

const AdjectiveTagSchema = z.literal('ADJ');
export type ADJECTIVE_TAG = z.infer<typeof AdjectiveTagSchema>;
export const ADJECTIVE_TAG = AdjectiveTagSchema.value;

const VerbTagSchema = z.literal('VERB');
export type VERB_TAG = z.infer<typeof VerbTagSchema>;
export const VERB_TAG = VerbTagSchema.value;

const PrepositionTagSchema = z.literal('PREP');
export type PREPOSITION_TAG = z.infer<typeof PrepositionTagSchema>;
export const PREPOSITION_TAG = PrepositionTagSchema.value;

const AdverbTagSchema = z.literal('ADV');
export type ADVERB_TAG = z.infer<typeof AdverbTagSchema>;
export const ADVERB_TAG = AdverbTagSchema.value;

const ParticleTagSchema = z.literal('PART');
export type PARTICLE_TAG = z.infer<typeof ParticleTagSchema>;
export const PARTICLE_TAG = ParticleTagSchema.value;

const ConjunctionTagSchema = z.literal('KON');
export type CONJUNCTION_TAG = z.infer<typeof ConjunctionTagSchema>;
export const CONJUNCTION_TAG = ConjunctionTagSchema.value;

const InteractionalUnitTagSchema = z.literal('IU');
export type INTERACTIONAL_UNIT_TAG = z.infer<typeof InteractionalUnitTagSchema>;
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

export const IdiomLiteralSchema = z.literal('Idiom');
export type IDIOM = z.infer<typeof IdiomLiteralSchema>;
export const IDIOM = IdiomLiteralSchema.value;

export const CollocationLiteralSchema = z.literal('Collocation');
export type COLLOCATION = z.infer<typeof CollocationLiteralSchema>;
export const COLLOCATION = CollocationLiteralSchema.value;

export const DiscourseFormulaLiteralSchema = z.literal('DiscourseFormula');
export type DISCOURSE_FORMULA = z.infer<typeof DiscourseFormulaLiteralSchema>;
export const DISCOURSE_FORMULA = DiscourseFormulaLiteralSchema.value;

export const ProverbLiteralSchema = z.literal('Proverb');
export type PROVERB = z.infer<typeof ProverbLiteralSchema>;
export const PROVERB = ProverbLiteralSchema.value;

export const CulturalQuotationLiteralSchema = z.literal('CulturalQuotation');
export type CULTURAL_QUOTATION = z.infer<typeof CulturalQuotationLiteralSchema>;
export const CULTURAL_QUOTATION = CulturalQuotationLiteralSchema.value;

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

export const GreetingLiteralSchema = z.literal('Greeting');
export type GREETING = z.infer<typeof GreetingLiteralSchema>;
export const GREETING = GreetingLiteralSchema.value;

export const FarewellLiteralSchema = z.literal('Farewell');
export type FAREWELL = z.infer<typeof FarewellLiteralSchema>;
export const FAREWELL = FarewellLiteralSchema.value;

export const ApologyLiteralSchema = z.literal('Apology');
export type APOLOGY = z.infer<typeof ApologyLiteralSchema>;
export const APOLOGY = ApologyLiteralSchema.value;

export const ThanksLiteralSchema = z.literal('Thanks');
export type THANKS = z.infer<typeof ThanksLiteralSchema>;
export const THANKS = ThanksLiteralSchema.value;

export const AcknowledgmentLiteralSchema = z.literal('Acknowledgment');
export type ACKNOWLEDGMENT = z.infer<typeof AcknowledgmentLiteralSchema>;
export const ACKNOWLEDGMENT = AcknowledgmentLiteralSchema.value;

export const RefusalLiteralSchema = z.literal('Refusal');
export type REFUSAL = z.infer<typeof RefusalLiteralSchema>;
export const REFUSAL = RefusalLiteralSchema.value;

export const RequestLiteralSchema = z.literal('Request');
export type REQUEST = z.infer<typeof RequestLiteralSchema>;
export const REQUEST = RequestLiteralSchema.value;

export const ReactionLiteralSchema = z.literal('Reaction');
export type REACTION = z.infer<typeof ReactionLiteralSchema>;
export const REACTION = ReactionLiteralSchema.value;

export const InitiationLiteralSchema = z.literal('Initiation');
export type INITIATION = z.infer<typeof InitiationLiteralSchema>;
export const INITIATION = InitiationLiteralSchema.value;

export const TransitionLiteralSchema = z.literal('Transition');
export type TRANSITION = z.infer<typeof TransitionLiteralSchema>;
export const TRANSITION = TransitionLiteralSchema.value;

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

export const FreeLiteralSchema = z.literal('Free');
export type FREE = z.infer<typeof FreeLiteralSchema>;
export const FREE = FreeLiteralSchema.value;

export const BoundLiteralSchema = z.literal('Bound');
export type BOUND = z.infer<typeof BoundLiteralSchema>;
export const BOUND = BoundLiteralSchema.value;

export const FrozenLiteralSchema = z.literal('Frozen');
export type FROZEN = z.infer<typeof FrozenLiteralSchema>;
export const FROZEN = FrozenLiteralSchema.value;

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

// Semantics/STYLISTIC_TONE

export const NeutralLiteralSchema = z.literal('Neutral');
export type NEUTRAL = z.infer<typeof NeutralLiteralSchema>;
export const NEUTRAL = NeutralLiteralSchema.value;

export const CasualLiteralSchema = z.literal('Casual');
export type CASUAL = z.infer<typeof CasualLiteralSchema>;
export const CASUAL = CasualLiteralSchema.value;

export const ColloquialLiteralSchema = z.literal('Colloquial');
export type COLLOQUIAL = z.infer<typeof ColloquialLiteralSchema>;
export const COLLOQUIAL = ColloquialLiteralSchema.value;

export const MarkedLiteralSchema = z.literal('Marked');
export type MARKED = z.infer<typeof MarkedLiteralSchema>;
export const MARKED = MarkedLiteralSchema.value;

export const FormalLiteralSchema = z.literal('Formal');
export type FORMAL = z.infer<typeof FormalLiteralSchema>;
export const FORMAL = FormalLiteralSchema.value;

export const VulgarLiteralSchema = z.literal('Vulgar');
export type VULGAR = z.infer<typeof VulgarLiteralSchema>;
export const VULGAR = VulgarLiteralSchema.value;

export const TabooProneLiteralSchema = z.literal('TabooProne');
export type TABOO_PRONE = z.infer<typeof TabooProneLiteralSchema>;
export const TABOO_PRONE = TabooProneLiteralSchema.value;

export const PoeticLiteralSchema = z.literal('Poetic');
export type POETIC = z.infer<typeof PoeticLiteralSchema>;
export const POETIC = PoeticLiteralSchema.value;

export const STYLISTIC_TONE_STR = [
	NEUTRAL, // default, unmarked
	CASUAL, // relaxed, friendly tone
	COLLOQUIAL, // informal, everyday speech
	MARKED, // emotionally loaded or stylistically salient
	FORMAL, // elevated, institutional, academic
	VULGAR, // socially inappropriate, low register
	TABOO_PRONE, // context-sensitive, bordering on offensive
	POETIC, // literary, metaphor-rich, stylistically rare
] as const;

export const StylisticToneSchema = z.enum(STYLISTIC_TONE_STR);
export type StylisticTone = z.infer<typeof StylisticToneSchema>;
export const StylisticTone = StylisticToneSchema.enum;
export const STYLISTIC_TONES = StylisticToneSchema.options;

// aspectual class Punctual / Telic
// participant roles: Agent, Patient
// possible frame elements: Instrument, BodyPart, Manner

// semantic primitives
// anfassen(x, y) ≈ cause(x, contact(touch(x, y)))

// Aspekts
// - Auxiliary verb
// -

// LexicalRelations

export const SynonymLiteralSchema = z.literal('Synonym');
export type SYNONYM = z.infer<typeof SynonymLiteralSchema>;
export const SYNONYM = SynonymLiteralSchema.value;

export const AntonymLiteralSchema = z.literal('Antonym');
export type ANTONYM = z.infer<typeof AntonymLiteralSchema>;
export const ANTONYM = AntonymLiteralSchema.value;

export const HyponymLiteralSchema = z.literal('Hyponym');
export type HYPONYM = z.infer<typeof HyponymLiteralSchema>;
export const HYPONYM = HyponymLiteralSchema.value;

export const HypernymLiteralSchema = z.literal('Hypernym');
export type HYPERNYM = z.infer<typeof HypernymLiteralSchema>;
export const HYPERNYM = HypernymLiteralSchema.value;

export const MeronymLiteralSchema = z.literal('Meronym');
export type MERONYM = z.infer<typeof MeronymLiteralSchema>;
export const MERONYM = MeronymLiteralSchema.value;

export const HolonymLiteralSchema = z.literal('Holonym');
export type HOLONYM = z.infer<typeof HolonymLiteralSchema>;
export const HOLONYM = HolonymLiteralSchema.value;

export const TroponymLiteralSchema = z.literal('Troponym');
export type TROPONYM = z.infer<typeof TroponymLiteralSchema>;
export const TROPONYM = TroponymLiteralSchema.value;

export const ComplementLiteralSchema = z.literal('Complement');
export type COMPLEMENT = z.infer<typeof ComplementLiteralSchema>;
export const COMPLEMENT = ComplementLiteralSchema.value;

// Semantics/DIMENSION

export const IntensityLiteralSchema = z.literal('Intensity');
export type INTENSITY = z.infer<typeof IntensityLiteralSchema>;
export const INTENSITY = IntensityLiteralSchema.value;

export const ForceLiteralSchema = z.literal('Force');
export type FORCE = z.infer<typeof ForceLiteralSchema>;
export const FORCE = ForceLiteralSchema.value;

export const MannerLiteralSchema = z.literal('Manner');
export type MANNER = z.infer<typeof MannerLiteralSchema>;
export const MANNER = MannerLiteralSchema.value;

export const FrequencyLiteralSchema = z.literal('Frequency');
export type FREQUENCY = z.infer<typeof FrequencyLiteralSchema>;
export const FREQUENCY = FrequencyLiteralSchema.value;

export const DegreeLiteralSchema = z.literal('Degree');
export type DEGREE = z.infer<typeof DegreeLiteralSchema>;
export const DEGREE = DegreeLiteralSchema.value;

export const AmountLiteralSchema = z.literal('Amount');
export type AMOUNT = z.infer<typeof AmountLiteralSchema>;
export const AMOUNT = AmountLiteralSchema.value;

export const CertaintyLiteralSchema = z.literal('Certainty');
export type CERTAINTY = z.infer<typeof CertaintyLiteralSchema>;
export const CERTAINTY = CertaintyLiteralSchema.value;

export const ObligationLiteralSchema = z.literal('Obligation');
export type OBLIGATION = z.infer<typeof ObligationLiteralSchema>;
export const OBLIGATION = ObligationLiteralSchema.value;

export const SpaceLiteralSchema = z.literal('Space');
export type SPACE = z.infer<typeof SpaceLiteralSchema>;
export const SPACE = SpaceLiteralSchema.value;

export const DEFINED_DIMENSIONS_STR = [
	INTENSITY, // how much or how strong (e.g. "very", "intense")
	FORCE, // power or strength (e.g. "mild", "extreme")
	MANNER, // how something is done (e.g. "carefully", "recklessly")
	FREQUENCY, // how often (e.g. "rarely", "always")
	DEGREE, // scalar extent (e.g. "slightly", "totally")
	AMOUNT, // quantity (e.g. "many", "a bit")
	CERTAINTY, // confidence level (e.g. "probably", "definitely")
	OBLIGATION, // modal necessity (e.g. "should", "must")
	SPACE, // physical distance or position (e.g. "near", "far")
] as const;

export const DefinedDimensionSchema = z.enum(DEFINED_DIMENSIONS_STR);
export type DefinedDimension = z.infer<typeof DefinedDimensionSchema>;
export const DefinedDimension = DefinedDimensionSchema.enum;
export const DEFINED_DIMENSIONS = DefinedDimensionSchema.options;

// Semantics/ScalarDegree

export const NegligibleLiteralSchema = z.literal('Lacking');
export type NEGLIGIBLE = z.infer<typeof NegligibleLiteralSchema>;
export const NEGLIGIBLE = NegligibleLiteralSchema.value;

export const LackingLiteralSchema = z.literal('Lacking');
export type LACKING = z.infer<typeof LackingLiteralSchema>;
export const LACKING = LackingLiteralSchema.value;

export const MinimalLiteralSchema = z.literal('Minimal');
export type MINIMAL = z.infer<typeof MinimalLiteralSchema>;
export const MINIMAL = MinimalLiteralSchema.value;

export const WeakLiteralSchema = z.literal('Weak');
export type WEAK = z.infer<typeof WeakLiteralSchema>;
export const WEAK = WeakLiteralSchema.value;

export const SoftenedLiteralSchema = z.literal('Softened');
export type SOFTENED = z.infer<typeof SoftenedLiteralSchema>;
export const SOFTENED = SoftenedLiteralSchema.value;

export const LowLiteralSchema = z.literal('Low');
export type LOW = z.infer<typeof LowLiteralSchema>;
export const LOW = LowLiteralSchema.value;

export const MildLiteralSchema = z.literal('Mild');
export type MILD = z.infer<typeof MildLiteralSchema>;
export const MILD = MildLiteralSchema.value;

export const ModerateLiteralSchema = z.literal('Moderate');
export type MODERATE = z.infer<typeof ModerateLiteralSchema>;
export const MODERATE = ModerateLiteralSchema.value;

export const StrongLiteralSchema = z.literal('Strong');
export type STRONG = z.infer<typeof StrongLiteralSchema>;
export const STRONG = StrongLiteralSchema.value;

export const IntenseLiteralSchema = z.literal('Intense');
export type INTENSE = z.infer<typeof IntenseLiteralSchema>;
export const INTENSE = IntenseLiteralSchema.value;

export const MaximalLiteralSchema = z.literal('Maximal');
export type MAXIMAL = z.infer<typeof MaximalLiteralSchema>;
export const MAXIMAL = MaximalLiteralSchema.value;

export const SCALAR_DEGREE_STR = [
	NEGLIGIBLE, // -5
	MINIMAL, // -4
	WEAK, // -3
	SOFTENED, // -2
	LOW, // -1
	NEUTRAL, //  0
	MILD, //  1
	MODERATE, //  2
	STRONG, //  3
	INTENSE, //  4
	MAXIMAL, //  5
] as const;

export const ScalarDegreeSchema = z.enum(SCALAR_DEGREE_STR);

export type ScalarDegree = z.infer<typeof ScalarDegreeSchema>;
export const ScalarDegree = ScalarDegreeSchema.enum;
export const SCALAR_DEGREES = ScalarDegreeSchema.options;

export const SCALAR_DEGREE_VALUES: Record<ScalarDegree, number> = {
	[ScalarDegree.Lacking]: -5,
	[ScalarDegree.Minimal]: -4,
	[ScalarDegree.Weak]: -3,
	[ScalarDegree.Softened]: -2,
	[ScalarDegree.Low]: -1,
	[ScalarDegree.Neutral]: 0,
	[ScalarDegree.Mild]: 1,
	[ScalarDegree.Moderate]: 2,
	[ScalarDegree.Strong]: 3,
	[ScalarDegree.Intense]: 4,
	[ScalarDegree.Maximal]: 5,
} as const;

// Inflections

export const PersonLiteralSchema = z.literal('Person');
export type PERSON = z.infer<typeof PersonLiteralSchema>;
export const PERSON = PersonLiteralSchema.value;

export const NumberLiteralSchema = z.literal('Number');
export type NUMBER = z.infer<typeof NumberLiteralSchema>;
export const NUMBER = NumberLiteralSchema.value;

export const GenderLiteralSchema = z.literal('Gender');
export type GENDER = z.infer<typeof GenderLiteralSchema>;
export const GENDER = GenderLiteralSchema.value;

export const CaseLiteralSchema = z.literal('Case');
export type CASE = z.infer<typeof CaseLiteralSchema>;
export const CASE = CaseLiteralSchema.value;

export const TenseLiteralSchema = z.literal('Tense');
export type TENSE = z.infer<typeof TenseLiteralSchema>;
export const TENSE = TenseLiteralSchema.value;

export const AspectLiteralSchema = z.literal('Aspect');
export type ASPECT = z.infer<typeof AspectLiteralSchema>;
export const ASPECT = AspectLiteralSchema.value;

export const MoodLiteralSchema = z.literal('Mood');
export type MOOD = z.infer<typeof MoodLiteralSchema>;
export const MOOD = MoodLiteralSchema.value;

export const VoiceLiteralSchema = z.literal('Voice');
export type VOICE = z.infer<typeof VoiceLiteralSchema>;
export const VOICE = VoiceLiteralSchema.value;

export const PolarityLiteralSchema = z.literal('Polarity');
export type POLARITY = z.infer<typeof PolarityLiteralSchema>;
export const POLARITY = PolarityLiteralSchema.value;

export const EvidentialityLiteralSchema = z.literal('Evidentiality');
export type EVIDENTIALITY = z.infer<typeof EvidentialityLiteralSchema>;
export const EVIDENTIALITY = EvidentialityLiteralSchema.value;

export const ClusivityLiteralSchema = z.literal('Clusivity');
export type CLUSIVITY = z.infer<typeof ClusivityLiteralSchema>;
export const CLUSIVITY = ClusivityLiteralSchema.value;

export const AnimacyLiteralSchema = z.literal('Animacy');
export type ANIMACY = z.infer<typeof AnimacyLiteralSchema>;
export const ANIMACY = AnimacyLiteralSchema.value;

export const HonorificLiteralSchema = z.literal('Honorific');
export type HONORIFIC = z.infer<typeof HonorificLiteralSchema>;
export const HONORIFIC = HonorificLiteralSchema.value;

export const ComparisonLiteralSchema = z.literal('Comparison');
export type COMPARISON = z.infer<typeof ComparisonLiteralSchema>;
export const COMPARISON = ComparisonLiteralSchema.value;

export const INFLECTIONAL_DIMENSIONS_STR = [
	PERSON, // who is involved (1st, 2nd, 3rd)
	NUMBER, // singular, plural, dual, etc.
	GENDER, // grammatical gender
	CASE, // syntactic role of noun
	TENSE, // time of action/event
	ASPECT, // event structure (e.g. ongoing, completed)
	MOOD, // speaker’s attitude (e.g. subjunctive)
	VOICE, // active, passive, middle
	POLARITY, // positive vs. negative
	EVIDENTIALITY, // source of information (e.g. hearsay)
	CLUSIVITY, // inclusive/exclusive 'we'
	ANIMACY, // animate vs. inanimate distinctions
	HONORIFIC, // politeness/formality level
	DEGREE, // gradation (e.g. strong, stronger)
	COMPARISON, // comparative, superlative, etc.
] as const;

export const InflectionalDimensionSchema = z.enum(INFLECTIONAL_DIMENSIONS_STR);
export type InflectionalDimension = z.infer<typeof InflectionalDimensionSchema>;
export const InflectionalDimension = InflectionalDimensionSchema.enum;
export const INFLECTIONAL_DIMENSIONS = InflectionalDimensionSchema.options;

// PERSON
export const FirstSchema = z.literal('First');
export type First = z.infer<typeof FirstSchema>;
export const FIRST = FirstSchema.value;

export const SecondSchema = z.literal('Second');
export type Second = z.infer<typeof SecondSchema>;
export const SECOND = SecondSchema.value;

export const ThirdSchema = z.literal('Third');
export type Third = z.infer<typeof ThirdSchema>;
export const THIRD = ThirdSchema.value;

export const PERSONS_STR = [
	FIRST, // speaker (I, we)
	SECOND, // addressee (you)
	THIRD, // other (he, she, it, they)
] as const;

export const PersonSchema = z.enum(PERSONS_STR);
export type Person = z.infer<typeof PersonSchema>;
export const Person = PersonSchema.enum;
export const PERSONS = PersonSchema.options;

// Noun classes
export const CommonSchema = z.literal('Common');
export type Common = z.infer<typeof CommonSchema>;
export const COMMON = CommonSchema.value;

export const MassSchema = z.literal('Mass');
export type Mass = z.infer<typeof MassSchema>;
export const MASS = MassSchema.value;

export const ProperSchema = z.literal('Proper');
export type Proper = z.infer<typeof ProperSchema>;
export const PROPER = ProperSchema.value;

export const CollectiveSchema = z.literal('Collective');
export type Collective = z.infer<typeof CollectiveSchema>;
export const COLLECTIVE = CollectiveSchema.value;

export const NOUN_CLASSES_STR = [
	COMMON, // countable category noun (e.g. "tree", "dog")
	MASS, // uncountable substance (e.g. "water", "sand")
	PROPER, // unique named entity (e.g. "Berlin", "Anna")
	COLLECTIVE, // singular noun for group (e.g. "team", "audience")
] as const;

export const NounClassSchema = z.enum(NOUN_CLASSES_STR);
export type NounClass = z.infer<typeof NounClassSchema>;
export const NounClass = NounClassSchema.enum;
export const NOUN_CLASSES = NounClassSchema.options;
