import { z } from "zod";

export const ReadSchema = z.literal("Read");
export type READ = z.infer<typeof ReadSchema>;
export const READ = ReadSchema.value;

// Format
const SlashSchema = z.literal("/");
export type SLASH = z.infer<typeof SlashSchema>;
export const SLASH = SlashSchema.value;

const BirdSchema = z.literal("^");
export type BIRD = z.infer<typeof BirdSchema>;
export const BIRD = BirdSchema.value;

const SpaceFormatSchema = z.literal(" ");
export type SPACE_F = z.infer<typeof SpaceFormatSchema>;
export const SPACE_F = SpaceFormatSchema.value;

const TabSchema = z.literal("\t");
export type TAB = z.infer<typeof TabSchema>;
export const TAB = TabSchema.value;

const LineBreakSchema = z.literal("\n");
export type LINE_BREAK = z.infer<typeof LineBreakSchema>;
export const LINE_BREAK = LineBreakSchema.value;

const StarSchema = z.literal("*");
export type STAR = z.infer<typeof StarSchema>;
export const STAR = StarSchema.value;

const BackArrowSchema = z.literal("←");
export type BACK_ARROW = z.infer<typeof BackArrowSchema>;
export const BACK_ARROW = BackArrowSchema.value;

const ObsidianLinkOpenSchema = z.literal("[[");
export type OBSIDIAN_LINK_OPEN = z.infer<typeof ObsidianLinkOpenSchema>;
export const OBSIDIAN_LINK_OPEN = ObsidianLinkOpenSchema.value;

const ObsidianLinkCloseSchema = z.literal("]]");
export type OBSIDIAN_LINK_CLOSE = z.infer<typeof ObsidianLinkCloseSchema>;
export const OBSIDIAN_LINK_CLOSE = ObsidianLinkCloseSchema.value;

const DoneCheckboxSchema = z.literal("- [x]");
export type DONE_CHECKBOX = z.infer<typeof DoneCheckboxSchema>;
export const DONE_CHECKBOX = DoneCheckboxSchema.value;

const NotStartedCheckboxSchema = z.literal("- [ ]");
export type NOT_STARTED_CHECKBOX = z.infer<typeof NotStartedCheckboxSchema>;
export const NOT_STARTED_CHECKBOX = NotStartedCheckboxSchema.value;

export const CheckboxSchema = z.union([
	z.literal(DONE_CHECKBOX),
	z.literal(NOT_STARTED_CHECKBOX),
]);
export type CHECKBOX = z.infer<typeof CheckboxSchema>;

const PipeSchema = z.literal("|");
export type PIPE = z.infer<typeof PipeSchema>;
export const PIPE = PipeSchema.value;

const HashSchema = z.literal("#");
export type HASH = z.infer<typeof HashSchema>;
export const HASH = HashSchema.value;

const LongDashSchema = z.literal("—");
export type LONG_DASH = z.infer<typeof LongDashSchema>;
export const LONG_DASH = LongDashSchema.value;

export const SmallEmDashSchema = z.literal("﹘");
export type SMALL_EM_DASH = z.infer<typeof SmallEmDashSchema>;
export const SMALL_EM_DASH = SmallEmDashSchema.value;

const DashSchema = z.literal("-");
export type DASH = z.infer<typeof DashSchema>;
export const DASH = DashSchema.value;

const NonBreakingHyphenSchema = z.literal("‑");
export type NON_BREAKING_HYPHEN = z.infer<typeof NonBreakingHyphenSchema>;
export const NON_BREAKING_HYPHEN = NonBreakingHyphenSchema.value;

export const UnderscoreSchema = z.literal("_");
export type UNDERSCORE = z.infer<typeof UnderscoreSchema>;
export const UNDERSCORE = UnderscoreSchema.value;

const PlusDelimeterSchema = z.literal(`${UNDERSCORE}plus${UNDERSCORE}`); // _plus_
export type PLUS_DELIMETER = z.infer<typeof PlusDelimeterSchema>;
export const PLUS_DELIMETER = PlusDelimeterSchema.value;

export const SPACE_LIKE_CHARS = [
	" ", // space
	"\u00A0", // non-breaking space
	"\t", // tab
	"\n", // new line
	"\r", // carriage return
	"\v", // vertical tab
	"\f", // form feed
	"\u1680", // OGHAM SPACE MARK
	"\u180E", // MONGOLIAN VOWEL SEPARATOR
	"\u2000", // EN QUAD
	"\u2001", // EM QUAD
	"\u2002", // EN SPACE
	"\u2003", // EM SPACE
	"\u2004", // THREE-PER-EM SPACE
	"\u2005", // FOUR-PER-EM SPACE
	"\u2006", // SIX-PER-EM SPACE
	"\u2007", // FIGURE SPACE
	"\u2008", // PUNCTUATION SPACE
	"\u2009", // THIN SPACE
	"\u200A", // HAIR SPACE
	"\u2028", // LINE SEPARATOR
	"\u2029", // PARAGRAPH SEPARATOR
	"\u202F", // NARROW NO-BREAK SPACE
	"\u205F", // MEDIUM MATHEMATICAL SPACE
	"\u3000", // IDEOGRAPHIC SPACE
] as const;

// Nodes
export const TextSchema = z.literal("Text");
export type TEXT = z.infer<typeof TextSchema>;
export const TEXT = TextSchema.value;

export const BookSchema = z.literal("Book");
export type BOOK = z.infer<typeof BookSchema>;
export const BOOK = BookSchema.value;

export const ScrollSchema = z.literal("Scroll");
export type SCROLL = z.infer<typeof ScrollSchema>;
export const SCROLL = ScrollSchema.value;

export const SectionSchema = z.literal("Section");
export type SECTION = z.infer<typeof SectionSchema>;
export const SECTION = SectionSchema.value;

export const PageSchema = z.literal("Page");
export type PAGE = z.infer<typeof PageSchema>;
export const PAGE = PageSchema.value;

export const NoteSchema = z.literal("Note");
export type NOTE = z.infer<typeof NoteSchema>;
export const NOTE = NoteSchema.value;

// Meta
export const UnmarkedSchema = z.literal("Unmarked");
export type UNMARKED = z.infer<typeof UnmarkedSchema>;
export const UNMARKED = UnmarkedSchema.value;

export const CodexSchema = z.literal("Codex");
export type CODEX = z.infer<typeof CodexSchema>;
export const CODEX = CodexSchema.value;

export const EntrySchema = z.literal("Entry");
export type ENTRY = z.infer<typeof EntrySchema>;
export const ENTRY = EntrySchema.value;

export const UnknownSchema = z.literal("Unknown");
export type UNKNOWN = z.infer<typeof UnknownSchema>;
export const UNKNOWN = UnknownSchema.value;

// Node statuses
export const DoneSchema = z.literal("Done");
export type DONE = z.infer<typeof DoneSchema>;
export const DONE = DoneSchema.value;

export const NotStartedSchema = z.literal("NotStarted");
export type NOT_STARTED = z.infer<typeof NotStartedSchema>;
export const NOT_STARTED = NotStartedSchema.value;

export const InProgressSchema = z.literal("InProgress");
export type IN_PROGRESS = z.infer<typeof InProgressSchema>;
export const IN_PROGRESS = InProgressSchema.value;

// Morphems

const PhraseSchema = z.literal("Phrase");
export type PHRASE = z.infer<typeof PhraseSchema>;
export const PHRASE = PhraseSchema.value;

export const PrefixLiteralSchema = z.literal("Prefix");
export type PREFIX = z.infer<typeof PrefixLiteralSchema>;
export const PREFIX = PrefixLiteralSchema.value;

export const SuffixLiteralSchema = z.literal("Suffix");
export type SUFFIX = z.infer<typeof SuffixLiteralSchema>;
export const SUFFIX = SuffixLiteralSchema.value;

export const InfixLiteralSchema = z.literal("Infix");
export type INFIX = z.infer<typeof InfixLiteralSchema>;
export const INFIX = InfixLiteralSchema.value;

export const CircumfixLiteralSchema = z.literal("Circumfix");
export type CIRCUMFIX = z.infer<typeof CircumfixLiteralSchema>;
export const CIRCUMFIX = CircumfixLiteralSchema.value;

export const LinkingElementLiteralSchema = z.literal("LinkingElement");
export type LINKING_ELEMENT = z.infer<typeof LinkingElementLiteralSchema>;
export const LINKING_ELEMENT = LinkingElementLiteralSchema.value;

// Linguistic units

export const PhrasemLiteralSchema = z.literal("Phrasem");
export type PHRASEM = z.infer<typeof PhrasemLiteralSchema>;
export const PHRASEM = PhrasemLiteralSchema.value;

export const LexemLiteralSchema = z.literal("Lexem");
export type LEXEM = z.infer<typeof LexemLiteralSchema>;
export const LEXEM = LexemLiteralSchema.value;

export const MorphemLiteralSchema = z.literal("Morphem");
export type MORPHEM = z.infer<typeof MorphemLiteralSchema>;
export const MORPHEM = MorphemLiteralSchema.value;

export const InflectionLiteralSchema = z.literal("Inflection");
export type INFLECTION = z.infer<typeof InflectionLiteralSchema>;
export const INFLECTION = InflectionLiteralSchema.value;

// Parts of Speech

export const NounLiteralSchema = z.literal("Noun");
export type NOUN = z.infer<typeof NounLiteralSchema>;
export const NOUN = NounLiteralSchema.value;

export const PronounLiteralSchema = z.literal("Pronoun");
export type PRONOUN = z.infer<typeof PronounLiteralSchema>;
export const PRONOUN = PronounLiteralSchema.value;

export const ArticleLiteralSchema = z.literal("Article");
export type ARTICLE = z.infer<typeof ArticleLiteralSchema>;
export const ARTICLE = ArticleLiteralSchema.value;

export const AdjectiveLiteralSchema = z.literal("Adjective");
export type ADJECTIVE = z.infer<typeof AdjectiveLiteralSchema>;
export const ADJECTIVE = AdjectiveLiteralSchema.value;

export const VerbLiteralSchema = z.literal("Verb");
export type VERB = z.infer<typeof VerbLiteralSchema>;
export const VERB = VerbLiteralSchema.value;

export const PrepositionLiteralSchema = z.literal("Preposition");
export type PREPOSITION = z.infer<typeof PrepositionLiteralSchema>;
export const PREPOSITION = PrepositionLiteralSchema.value;

export const AdverbLiteralSchema = z.literal("Adverb");
export type ADVERB = z.infer<typeof AdverbLiteralSchema>;
export const ADVERB = AdverbLiteralSchema.value;

export const ParticleLiteralSchema = z.literal("Particle");
export type PARTICLE = z.infer<typeof ParticleLiteralSchema>;
export const PARTICLE = ParticleLiteralSchema.value;

export const ConjunctionLiteralSchema = z.literal("Conjunction");
export type CONJUNCTION = z.infer<typeof ConjunctionLiteralSchema>;
export const CONJUNCTION = ConjunctionLiteralSchema.value;

export const InteractionalUnitLiteralSchema = z.literal("InteractionalUnit");
export type INTERACTIONAL_UNIT = z.infer<typeof InteractionalUnitLiteralSchema>;
export const INTERACTIONAL_UNIT = InteractionalUnitLiteralSchema.value;

// Parts of Speech/Tags

const NounTagSchema = z.literal("NOUN");
export type NOUN_TAG = z.infer<typeof NounTagSchema>;
export const NOUN_TAG = NounTagSchema.value;

const PronounTagSchema = z.literal("PRON");
export type PRONOUN_TAG = z.infer<typeof PronounTagSchema>;
export const PRONOUN_TAG = PronounTagSchema.value;

const ArticleTagSchema = z.literal("ART");
export type ARTICLE_TAG = z.infer<typeof ArticleTagSchema>;
export const ARTICLE_TAG = ArticleTagSchema.value;

const AdjectiveTagSchema = z.literal("ADJ");
export type ADJECTIVE_TAG = z.infer<typeof AdjectiveTagSchema>;
export const ADJECTIVE_TAG = AdjectiveTagSchema.value;

const VerbTagSchema = z.literal("VERB");
export type VERB_TAG = z.infer<typeof VerbTagSchema>;
export const VERB_TAG = VerbTagSchema.value;

const PrepositionTagSchema = z.literal("PREP");
export type PREPOSITION_TAG = z.infer<typeof PrepositionTagSchema>;
export const PREPOSITION_TAG = PrepositionTagSchema.value;

const AdverbTagSchema = z.literal("ADV");
export type ADVERB_TAG = z.infer<typeof AdverbTagSchema>;
export const ADVERB_TAG = AdverbTagSchema.value;

const ParticleTagSchema = z.literal("PART");
export type PARTICLE_TAG = z.infer<typeof ParticleTagSchema>;
export const PARTICLE_TAG = ParticleTagSchema.value;

const ConjunctionTagSchema = z.literal("KON");
export type CONJUNCTION_TAG = z.infer<typeof ConjunctionTagSchema>;
export const CONJUNCTION_TAG = ConjunctionTagSchema.value;

const InteractionalUnitTagSchema = z.literal("IU");
export type INTERACTIONAL_UNIT_TAG = z.infer<typeof InteractionalUnitTagSchema>;
export const INTERACTIONAL_UNIT_TAG = InteractionalUnitTagSchema.value;

// Phrasems/

export const IdiomLiteralSchema = z.literal("Idiom");
export type IDIOM = z.infer<typeof IdiomLiteralSchema>;
export const IDIOM = IdiomLiteralSchema.value;

export const CollocationLiteralSchema = z.literal("Collocation");
export type COLLOCATION = z.infer<typeof CollocationLiteralSchema>;
export const COLLOCATION = CollocationLiteralSchema.value;

export const DiscourseFormulaLiteralSchema = z.literal("DiscourseFormula");
export type DISCOURSE_FORMULA = z.infer<typeof DiscourseFormulaLiteralSchema>;
export const DISCOURSE_FORMULA = DiscourseFormulaLiteralSchema.value;

export const ProverbLiteralSchema = z.literal("Proverb");
export type PROVERB = z.infer<typeof ProverbLiteralSchema>;
export const PROVERB = ProverbLiteralSchema.value;

export const CulturalQuotationLiteralSchema = z.literal("CulturalQuotation");
export type CULTURAL_QUOTATION = z.infer<typeof CulturalQuotationLiteralSchema>;
export const CULTURAL_QUOTATION = CulturalQuotationLiteralSchema.value;

// Phrasems/DefinedDiscourseFormula/Role

export const GreetingLiteralSchema = z.literal("Greeting");
export type GREETING = z.infer<typeof GreetingLiteralSchema>;
export const GREETING = GreetingLiteralSchema.value;

export const FarewellLiteralSchema = z.literal("Farewell");
export type FAREWELL = z.infer<typeof FarewellLiteralSchema>;
export const FAREWELL = FarewellLiteralSchema.value;

export const ApologyLiteralSchema = z.literal("Apology");
export type APOLOGY = z.infer<typeof ApologyLiteralSchema>;
export const APOLOGY = ApologyLiteralSchema.value;

export const ThanksLiteralSchema = z.literal("Thanks");
export type THANKS = z.infer<typeof ThanksLiteralSchema>;
export const THANKS = ThanksLiteralSchema.value;

export const AcknowledgmentLiteralSchema = z.literal("Acknowledgment");
export type ACKNOWLEDGMENT = z.infer<typeof AcknowledgmentLiteralSchema>;
export const ACKNOWLEDGMENT = AcknowledgmentLiteralSchema.value;

export const RefusalLiteralSchema = z.literal("Refusal");
export type REFUSAL = z.infer<typeof RefusalLiteralSchema>;
export const REFUSAL = RefusalLiteralSchema.value;

export const RequestLiteralSchema = z.literal("Request");
export type REQUEST = z.infer<typeof RequestLiteralSchema>;
export const REQUEST = RequestLiteralSchema.value;

export const ReactionLiteralSchema = z.literal("Reaction");
export type REACTION = z.infer<typeof ReactionLiteralSchema>;
export const REACTION = ReactionLiteralSchema.value;

export const InitiationLiteralSchema = z.literal("Initiation");
export type INITIATION = z.infer<typeof InitiationLiteralSchema>;
export const INITIATION = InitiationLiteralSchema.value;

export const TransitionLiteralSchema = z.literal("Transition");
export type TRANSITION = z.infer<typeof TransitionLiteralSchema>;
export const TRANSITION = TransitionLiteralSchema.value;

// Phrasems/Collocation/Strength

export const FreeLiteralSchema = z.literal("Free");
export type FREE = z.infer<typeof FreeLiteralSchema>;
export const FREE = FreeLiteralSchema.value;

export const BoundLiteralSchema = z.literal("Bound");
export type BOUND = z.infer<typeof BoundLiteralSchema>;
export const BOUND = BoundLiteralSchema.value;

export const FrozenLiteralSchema = z.literal("Frozen");
export type FROZEN = z.infer<typeof FrozenLiteralSchema>;
export const FROZEN = FrozenLiteralSchema.value;

// STYLISTIC

// Semantics/STYLISTIC_TONE

export const NeutralLiteralSchema = z.literal("Neutral");
export type NEUTRAL = z.infer<typeof NeutralLiteralSchema>;
export const NEUTRAL = NeutralLiteralSchema.value;

export const CasualLiteralSchema = z.literal("Casual");
export type CASUAL = z.infer<typeof CasualLiteralSchema>;
export const CASUAL = CasualLiteralSchema.value;

export const ColloquialLiteralSchema = z.literal("Colloquial");
export type COLLOQUIAL = z.infer<typeof ColloquialLiteralSchema>;
export const COLLOQUIAL = ColloquialLiteralSchema.value;

export const MarkedLiteralSchema = z.literal("Marked");
export type MARKED = z.infer<typeof MarkedLiteralSchema>;
export const MARKED = MarkedLiteralSchema.value;

export const FormalLiteralSchema = z.literal("Formal");
export type FORMAL = z.infer<typeof FormalLiteralSchema>;
export const FORMAL = FormalLiteralSchema.value;

export const VulgarLiteralSchema = z.literal("Vulgar");
export type VULGAR = z.infer<typeof VulgarLiteralSchema>;
export const VULGAR = VulgarLiteralSchema.value;

export const TabooProneLiteralSchema = z.literal("TabooProne");
export type TABOO_PRONE = z.infer<typeof TabooProneLiteralSchema>;
export const TABOO_PRONE = TabooProneLiteralSchema.value;

export const PoeticLiteralSchema = z.literal("Poetic");
export type POETIC = z.infer<typeof PoeticLiteralSchema>;
export const POETIC = PoeticLiteralSchema.value;

// aspectual class Punctual / Telic
// participant roles: Agent, Patient
// possible frame elements: Instrument, BodyPart, Manner

// semantic primitives
// anfassen(x, y) ≈ cause(x, contact(touch(x, y)))

// Aspekts
// - Auxiliary verb
// -

// LexicalRelations

export const SynonymLiteralSchema = z.literal("Synonym");
export type SYNONYM = z.infer<typeof SynonymLiteralSchema>;
export const SYNONYM = SynonymLiteralSchema.value;

export const AntonymLiteralSchema = z.literal("Antonym");
export type ANTONYM = z.infer<typeof AntonymLiteralSchema>;
export const ANTONYM = AntonymLiteralSchema.value;

export const HyponymLiteralSchema = z.literal("Hyponym");
export type HYPONYM = z.infer<typeof HyponymLiteralSchema>;
export const HYPONYM = HyponymLiteralSchema.value;

export const HypernymLiteralSchema = z.literal("Hypernym");
export type HYPERNYM = z.infer<typeof HypernymLiteralSchema>;
export const HYPERNYM = HypernymLiteralSchema.value;

export const MeronymLiteralSchema = z.literal("Meronym");
export type MERONYM = z.infer<typeof MeronymLiteralSchema>;
export const MERONYM = MeronymLiteralSchema.value;

export const HolonymLiteralSchema = z.literal("Holonym");
export type HOLONYM = z.infer<typeof HolonymLiteralSchema>;
export const HOLONYM = HolonymLiteralSchema.value;

export const TroponymLiteralSchema = z.literal("Troponym");
export type TROPONYM = z.infer<typeof TroponymLiteralSchema>;
export const TROPONYM = TroponymLiteralSchema.value;

export const ComplementLiteralSchema = z.literal("Complement");
export type COMPLEMENT = z.infer<typeof ComplementLiteralSchema>;
export const COMPLEMENT = ComplementLiteralSchema.value;

// Semantics/DIMENSION

export const IntensityLiteralSchema = z.literal("Intensity");
export type INTENSITY = z.infer<typeof IntensityLiteralSchema>;
export const INTENSITY = IntensityLiteralSchema.value;

export const ForceLiteralSchema = z.literal("Force");
export type FORCE = z.infer<typeof ForceLiteralSchema>;
export const FORCE = ForceLiteralSchema.value;

export const MannerLiteralSchema = z.literal("Manner");
export type MANNER = z.infer<typeof MannerLiteralSchema>;
export const MANNER = MannerLiteralSchema.value;

export const FrequencyLiteralSchema = z.literal("Frequency");
export type FREQUENCY = z.infer<typeof FrequencyLiteralSchema>;
export const FREQUENCY = FrequencyLiteralSchema.value;

export const DegreeLiteralSchema = z.literal("Degree");
export type DEGREE = z.infer<typeof DegreeLiteralSchema>;
export const DEGREE = DegreeLiteralSchema.value;

export const AmountLiteralSchema = z.literal("Amount");
export type AMOUNT = z.infer<typeof AmountLiteralSchema>;
export const AMOUNT = AmountLiteralSchema.value;

export const CertaintyLiteralSchema = z.literal("Certainty");
export type CERTAINTY = z.infer<typeof CertaintyLiteralSchema>;
export const CERTAINTY = CertaintyLiteralSchema.value;

export const ObligationLiteralSchema = z.literal("Obligation");
export type OBLIGATION = z.infer<typeof ObligationLiteralSchema>;
export const OBLIGATION = ObligationLiteralSchema.value;

export const SpaceLiteralSchema = z.literal("Space");
export type SPACE = z.infer<typeof SpaceLiteralSchema>;
export const SPACE = SpaceLiteralSchema.value;

// Semantics/ScalarDegree

export const NegligibleLiteralSchema = z.literal("Lacking");
export type NEGLIGIBLE = z.infer<typeof NegligibleLiteralSchema>;
export const NEGLIGIBLE = NegligibleLiteralSchema.value;

export const LackingLiteralSchema = z.literal("Lacking");
export type LACKING = z.infer<typeof LackingLiteralSchema>;
export const LACKING = LackingLiteralSchema.value;

export const MinimalLiteralSchema = z.literal("Minimal");
export type MINIMAL = z.infer<typeof MinimalLiteralSchema>;
export const MINIMAL = MinimalLiteralSchema.value;

export const WeakLiteralSchema = z.literal("Weak");
export type WEAK = z.infer<typeof WeakLiteralSchema>;
export const WEAK = WeakLiteralSchema.value;

export const SoftenedLiteralSchema = z.literal("Softened");
export type SOFTENED = z.infer<typeof SoftenedLiteralSchema>;
export const SOFTENED = SoftenedLiteralSchema.value;

export const LowLiteralSchema = z.literal("Low");
export type LOW = z.infer<typeof LowLiteralSchema>;
export const LOW = LowLiteralSchema.value;

export const MildLiteralSchema = z.literal("Mild");
export type MILD = z.infer<typeof MildLiteralSchema>;
export const MILD = MildLiteralSchema.value;

export const ModerateLiteralSchema = z.literal("Moderate");
export type MODERATE = z.infer<typeof ModerateLiteralSchema>;
export const MODERATE = ModerateLiteralSchema.value;

export const StrongLiteralSchema = z.literal("Strong");
export type STRONG = z.infer<typeof StrongLiteralSchema>;
export const STRONG = StrongLiteralSchema.value;

export const IntenseLiteralSchema = z.literal("Intense");
export type INTENSE = z.infer<typeof IntenseLiteralSchema>;
export const INTENSE = IntenseLiteralSchema.value;

export const MaximalLiteralSchema = z.literal("Maximal");
export type MAXIMAL = z.infer<typeof MaximalLiteralSchema>;
export const MAXIMAL = MaximalLiteralSchema.value;

// Inflections

export const PersonLiteralSchema = z.literal("Person");
export type PERSON = z.infer<typeof PersonLiteralSchema>;
export const PERSON = PersonLiteralSchema.value;

export const NumberLiteralSchema = z.literal("Number");
export type NUMBER = z.infer<typeof NumberLiteralSchema>;
export const NUMBER = NumberLiteralSchema.value;

export const GenderLiteralSchema = z.literal("Gender");
export type GENDER = z.infer<typeof GenderLiteralSchema>;
export const GENDER = GenderLiteralSchema.value;

export const CaseLiteralSchema = z.literal("Case");
export type CASE = z.infer<typeof CaseLiteralSchema>;
export const CASE = CaseLiteralSchema.value;

export const TenseLiteralSchema = z.literal("Tense");
export type TENSE = z.infer<typeof TenseLiteralSchema>;
export const TENSE = TenseLiteralSchema.value;

export const AspectLiteralSchema = z.literal("Aspect");
export type ASPECT = z.infer<typeof AspectLiteralSchema>;
export const ASPECT = AspectLiteralSchema.value;

export const MoodLiteralSchema = z.literal("Mood");
export type MOOD = z.infer<typeof MoodLiteralSchema>;
export const MOOD = MoodLiteralSchema.value;

export const VoiceLiteralSchema = z.literal("Voice");
export type VOICE = z.infer<typeof VoiceLiteralSchema>;
export const VOICE = VoiceLiteralSchema.value;

export const PolarityLiteralSchema = z.literal("Polarity");
export type POLARITY = z.infer<typeof PolarityLiteralSchema>;
export const POLARITY = PolarityLiteralSchema.value;

export const EvidentialityLiteralSchema = z.literal("Evidentiality");
export type EVIDENTIALITY = z.infer<typeof EvidentialityLiteralSchema>;
export const EVIDENTIALITY = EvidentialityLiteralSchema.value;

export const ClusivityLiteralSchema = z.literal("Clusivity");
export type CLUSIVITY = z.infer<typeof ClusivityLiteralSchema>;
export const CLUSIVITY = ClusivityLiteralSchema.value;

export const AnimacyLiteralSchema = z.literal("Animacy");
export type ANIMACY = z.infer<typeof AnimacyLiteralSchema>;
export const ANIMACY = AnimacyLiteralSchema.value;

export const HonorificLiteralSchema = z.literal("Honorific");
export type HONORIFIC = z.infer<typeof HonorificLiteralSchema>;
export const HONORIFIC = HonorificLiteralSchema.value;

export const ComparisonLiteralSchema = z.literal("Comparison");
export type COMPARISON = z.infer<typeof ComparisonLiteralSchema>;
export const COMPARISON = ComparisonLiteralSchema.value;

// PERSON
export const FirstSchema = z.literal("First");
export type First = z.infer<typeof FirstSchema>;
export const FIRST = FirstSchema.value;

export const SecondSchema = z.literal("Second");
export type Second = z.infer<typeof SecondSchema>;
export const SECOND = SecondSchema.value;

export const ThirdSchema = z.literal("Third");
export type Third = z.infer<typeof ThirdSchema>;
export const THIRD = ThirdSchema.value;

// NUMBER
export const SingularLiteralSchema = z.literal("Singular");
export type SINGULAR = z.infer<typeof SingularLiteralSchema>;
export const SINGULAR = SingularLiteralSchema.value;

export const PluralLiteralSchema = z.literal("Plural");
export type PLURAL = z.infer<typeof PluralLiteralSchema>;
export const PLURAL = PluralLiteralSchema.value;

export const DualLiteralSchema = z.literal("Dual");
export type DUAL = z.infer<typeof DualLiteralSchema>;
export const DUAL = DualLiteralSchema.value;

// CASE
export const NominativeLiteralSchema = z.literal("Nominative");
export type NOMINATIVE = z.infer<typeof NominativeLiteralSchema>;
export const NOMINATIVE = NominativeLiteralSchema.value;

export const AccusativeLiteralSchema = z.literal("Accusative");
export type ACCUSATIVE = z.infer<typeof AccusativeLiteralSchema>;
export const ACCUSATIVE = AccusativeLiteralSchema.value;

export const DativeLiteralSchema = z.literal("Dative");
export type DATIVE = z.infer<typeof DativeLiteralSchema>;
export const DATIVE = DativeLiteralSchema.value;

export const GenitiveLiteralSchema = z.literal("Genitive");
export type GENITIVE = z.infer<typeof GenitiveLiteralSchema>;
export const GENITIVE = GenitiveLiteralSchema.value;

// TENSE
export const PresentLiteralSchema = z.literal("Present");
export type PRESENT = z.infer<typeof PresentLiteralSchema>;
export const PRESENT = PresentLiteralSchema.value;

export const PreteriteLiteralSchema = z.literal("Preterite");
export type PRETERITE = z.infer<typeof PreteriteLiteralSchema>;
export const PRETERITE = PreteriteLiteralSchema.value;

export const PerfectLiteralSchema = z.literal("Perfect");
export type PERFECT = z.infer<typeof PerfectLiteralSchema>;
export const PERFECT = PerfectLiteralSchema.value;

export const PluperfectLiteralSchema = z.literal("Pluperfect");
export type PLUPERFECT = z.infer<typeof PluperfectLiteralSchema>;
export const PLUPERFECT = PluperfectLiteralSchema.value;

export const FutureILiteralSchema = z.literal("FutureI");
export type FUTURE_I = z.infer<typeof FutureILiteralSchema>;
export const FUTURE_I = FutureILiteralSchema.value;

export const FutureIILiteralSchema = z.literal("FutureII");
export type FUTURE_II = z.infer<typeof FutureIILiteralSchema>;
export const FUTURE_II = FutureIILiteralSchema.value;

// Verb Mood
export const IndicativeLiteralSchema = z.literal("Indicative");
export type INDICATIVE = z.infer<typeof IndicativeLiteralSchema>;
export const INDICATIVE = IndicativeLiteralSchema.value;

export const SubjunctiveILiteralSchema = z.literal("SubjunctiveI");
export type SUBJUNCTIVE_I = z.infer<typeof SubjunctiveILiteralSchema>;
export const SUBJUNCTIVE_I = SubjunctiveILiteralSchema.value;

export const SubjunctiveIILiteralSchema = z.literal("SubjunctiveII");
export type SUBJUNCTIVE_II = z.infer<typeof SubjunctiveIILiteralSchema>;
export const SUBJUNCTIVE_II = SubjunctiveIILiteralSchema.value;

export const ImperativeLiteralSchema = z.literal("Imperative");
export type IMPERATIVE = z.infer<typeof ImperativeLiteralSchema>;
export const IMPERATIVE = ImperativeLiteralSchema.value;

// Noun classes
export const CommonSchema = z.literal("Common");
export type Common = z.infer<typeof CommonSchema>;
export const COMMON = CommonSchema.value;

export const MassSchema = z.literal("Mass");
export type Mass = z.infer<typeof MassSchema>;
export const MASS = MassSchema.value;

export const ProperSchema = z.literal("Proper");
export type Proper = z.infer<typeof ProperSchema>;
export const PROPER = ProperSchema.value;

export const CollectiveSchema = z.literal("Collective");
export type Collective = z.infer<typeof CollectiveSchema>;
export const COLLECTIVE = CollectiveSchema.value;

// Com degree
export const PositiveLiteralSchema = z.literal("Positive");
export type POSITIVE = z.infer<typeof PositiveLiteralSchema>;
export const POSITIVE = PositiveLiteralSchema.value;

export const ComparativeLiteralSchema = z.literal("Comparative");
export type COMPARATIVE = z.infer<typeof ComparativeLiteralSchema>;
export const COMPARATIVE = ComparativeLiteralSchema.value;

export const SuperlativeLiteralSchema = z.literal("Superlative");
export type SUPERLATIVE = z.infer<typeof SuperlativeLiteralSchema>;
export const SUPERLATIVE = SuperlativeLiteralSchema.value;

// Theta-Roles
export const AgentLiteralSchema = z.literal("AGENT");
export type AGENT = z.infer<typeof AgentLiteralSchema>;
export const AGENT = AgentLiteralSchema.value;

export const CauseLiteralSchema = z.literal("CAUSE");
export type CAUSE = z.infer<typeof CauseLiteralSchema>;
export const CAUSE = CauseLiteralSchema.value;

export const ExperiencerLiteralSchema = z.literal("EXPERIENCER");
export type EXPERIENCER = z.infer<typeof ExperiencerLiteralSchema>;
export const EXPERIENCER = ExperiencerLiteralSchema.value;

export const LocationLiteralSchema = z.literal("LOCATION");
export type LOCATION = z.infer<typeof LocationLiteralSchema>;
export const LOCATION = LocationLiteralSchema.value;

export const GoalLiteralSchema = z.literal("GOAL");
export type GOAL = z.infer<typeof GoalLiteralSchema>;
export const GOAL = GoalLiteralSchema.value;

export const BeneficiaryLiteralSchema = z.literal("BENEFICIARY");
export type BENEFICIARY = z.infer<typeof BeneficiaryLiteralSchema>;
export const BENEFICIARY = BeneficiaryLiteralSchema.value;

export const PossessorLiteralSchema = z.literal("POSSESSOR");
export type POSSESSOR = z.infer<typeof PossessorLiteralSchema>;
export const POSSESSOR = PossessorLiteralSchema.value;

export const PossessedLiteralSchema = z.literal("POSSESSED");
export type POSSESSED = z.infer<typeof PossessedLiteralSchema>;
export const POSSESSED = PossessedLiteralSchema.value;

export const ThemeLiteralSchema = z.literal("THEME");
export type THEME = z.infer<typeof ThemeLiteralSchema>;
export const THEME = ThemeLiteralSchema.value;
