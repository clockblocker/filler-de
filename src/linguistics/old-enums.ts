import { z } from "zod";
import {
	ACCUSATIVE,
	ACKNOWLEDGMENT,
	AGENT,
	AMOUNT,
	ANIMACY,
	APOLOGY,
	ASPECT,
	BENEFICIARY,
	BOUND,
	CASE,
	CASUAL,
	CAUSE,
	CERTAINTY,
	CLUSIVITY,
	COLLECTIVE,
	COLLOQUIAL,
	COMMON,
	COMPARATIVE,
	COMPARISON,
	DATIVE,
	DEGREE,
	DUAL,
	EVIDENTIALITY,
	EXPERIENCER,
	FAREWELL,
	FIRST,
	FORCE,
	FORMAL,
	FREE,
	FREQUENCY,
	FROZEN,
	FUTURE_I,
	FUTURE_II,
	GENDER,
	GENITIVE,
	GOAL,
	GREETING,
	HONORIFIC,
	IMPERATIVE,
	INDICATIVE,
	INITIATION,
	INTENSE,
	INTENSITY,
	LOCATION,
	LOW,
	MANNER,
	MARKED,
	MASS,
	MAXIMAL,
	MILD,
	MINIMAL,
	MODERATE,
	MOOD,
	NEGLIGIBLE,
	NEUTRAL,
	NOMINATIVE,
	NUMBER,
	OBLIGATION,
	PERFECT,
	PERSON,
	PHRASE,
	PLUPERFECT,
	PLURAL,
	PLUS_DELIMETER,
	POETIC,
	POLARITY,
	POSITIVE,
	POSSESSED,
	POSSESSOR,
	PRESENT,
	PRETERITE,
	PROPER,
	REACTION,
	REFUSAL,
	REQUEST,
	SECOND,
	SINGULAR,
	SOFTENED,
	SPACE,
	STRONG,
	SUBJUNCTIVE_I,
	SUBJUNCTIVE_II,
	SUPERLATIVE,
	TABOO_PRONE,
	TENSE,
	THANKS,
	THEME,
	THIRD,
	TRANSITION,
	VOICE,
	VULGAR,
	WEAK,
} from "../types/literals";
import { PosTag } from "./common/enums/linguistic-units/lexem/pos";

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
	DEFINED_DISCOURSE_FORMULA_ROLES_STR,
);

export type DefinedDiscourseFormulaRole = z.infer<
	typeof DefinedDiscourseFormulaRoleSchema
>;
export const DefinedDiscourseFormulaRole =
	DefinedDiscourseFormulaRoleSchema.enum;

export const DEFINED_DISCOURSE_FORMULA_ROLES =
	DefinedDiscourseFormulaRoleSchema.options;

export const DiscourseFormulaRoleSchema = DefinedDiscourseFormulaRoleSchema.or(
	z.string(),
);

export type DiscourseFormulaRole = z.infer<typeof DiscourseFormulaRoleSchema>;

export const COLLOCATION_STRENGTH_STR = [FREE, BOUND, FROZEN] as const;

export const CollocationStrengthSchema = z.enum(COLLOCATION_STRENGTH_STR);

export type CollocationStrength = z.infer<typeof CollocationStrengthSchema>;
export const CollocationStrength = CollocationStrengthSchema.enum;
export const COLLOCATION_STRENGTHS = CollocationStrengthSchema.options;

// Phrasems/Collocation/Type

const COLLOCATION_KINDS_STR = [
	`${PosTag.ADJ}${PLUS_DELIMETER}${PosTag.NOUN}`, // ADJ_plus_NOUN e.g. "strong tea", "deep sleep"
	`${PosTag.NOUN}${PLUS_DELIMETER}${PosTag.NOUN}`, // NOUN_plus_NOUN e.g. "chicken soup", "data center"
	`${PosTag.NOUN}${PLUS_DELIMETER}${PosTag.VERB}`, // NOUN_plus_VERB e.g. "dogs bark", "alarms ring"
	`${PosTag.VERB}${PLUS_DELIMETER}${PosTag.NOUN}`, // VERB_plus_NOUN e.g. "make a decision", "catch a cold"
	`${PosTag.ADV}${PLUS_DELIMETER}${PosTag.ADJ}`, // ADV_plus_ADJ e.g. "deeply sorry", "highly unlikely"
	`${PosTag.VERB}${PLUS_DELIMETER}${PosTag.ADV}`, // VERB_plus_ADV e.g. "speak loudly", "run fast"
	`${PosTag.PREP}_${PHRASE},`,
] as const;

export const CollocationKindSchema = z.enum(COLLOCATION_KINDS_STR);

export type CollocationKind = z.infer<typeof CollocationKindSchema>;
export const CollocationKind = CollocationKindSchema.enum;
export const COLLOCATION_KINDS = CollocationKindSchema.options;

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

export const PERSONS_STR = [
	FIRST, // speaker (I, we)
	SECOND, // addressee (you)
	THIRD, // other (he, she, it, they)
] as const;

export const PersonSchema = z.enum(PERSONS_STR);
export type Person = z.infer<typeof PersonSchema>;
export const Person = PersonSchema.enum;
export const PERSONS = PersonSchema.options;

export const NUMBER_VALUES_STR = [
	SINGULAR, // one entity
	PLURAL, // more than one
	DUAL,
] as const;

export const NumberKindSchema = z.enum(NUMBER_VALUES_STR);
export type NumberKind = z.infer<typeof NumberKindSchema>;
export const NumberKind = NumberKindSchema.enum;
export const NUMBER_KINDS = NumberKindSchema.options;

export const CASE_VALUES_STR = [
	NOMINATIVE, // subject position
	ACCUSATIVE, // direct object
	DATIVE, // indirect object
	GENITIVE, // possession/association
] as const;

export const CaseSchema = z.enum(CASE_VALUES_STR);
export type Case = z.infer<typeof CaseSchema>;
export const Case = CaseSchema.enum;
export const CASES = CaseSchema.options;

export const TENSE_VALUES_STR = [
	PRESENT,
	PRETERITE,
	PERFECT,
	PLUPERFECT,
	FUTURE_I,
	FUTURE_II,
] as const;

export const TenseSchema = z.enum(TENSE_VALUES_STR);
export type Tense = z.infer<typeof TenseSchema>;
export const Tense = TenseSchema.enum;
export const TENSES = TenseSchema.options;

export const VERB_MOODS_STR = [
	INDICATIVE, // factual or real-world statements
	SUBJUNCTIVE_I, // indirect speech, reported content
	SUBJUNCTIVE_II, // hypothetical or counterfactual
	IMPERATIVE, // command or request
] as const;

export const VerbMoodSchema = z.enum(VERB_MOODS_STR);
export type VerbMood = z.infer<typeof VerbMoodSchema>;
export const VerbMood = VerbMoodSchema.enum;
export const VERB_MOODS = VerbMoodSchema.options;

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

export const COMPARISON_DEGREES_STR = [
	POSITIVE, // base form (e.g. "fast")
	COMPARATIVE, // comparative form (e.g. "faster")
	SUPERLATIVE, // superlative form (e.g. "fastest")
] as const;

export const ComparisonDegreeSchema = z.enum(COMPARISON_DEGREES_STR);
export type ComparisonDegree = z.infer<typeof ComparisonDegreeSchema>;
export const ComparisonDegree = ComparisonDegreeSchema.enum;
export const COMPARISON_DEGREES = ComparisonDegreeSchema.options;

export const THETA_ROLES_STR = [
	AGENT,
	CAUSE,
	EXPERIENCER,
	LOCATION,
	GOAL,
	BENEFICIARY,
	POSSESSOR,
	POSSESSED,
	THEME,
] as const;

export const ThetaRoleSchema = z.enum(THETA_ROLES_STR);
export type ThetaRole = z.infer<typeof ThetaRoleSchema>;
export const ThetaRole = ThetaRoleSchema.enum;
export const THETA_ROLES = ThetaRoleSchema.options;

// plural_nom, dat, akk, gen
// Akteure, dem Akteur, den Akteur, des Akteurs
// Gründe, dem Grund, den Grund, des Grundes
// Erfahrer, dem Erfahrer, den Erfahrer, des Erfahrers
// Orte, dem Ort, den Ort, des Ortes
// Ziele, dem Ziel, das Ziel, des Ziels
// Empfänger, dem Empfänger, den Empfänger, des Empfängers
// Besitzer, dem Besitzer, den Besitzer, des Besitzers
// Besitze, dem Besitz, den Besitz, des Besitzes
// Gegenstände, dem Gegenstand, den Gegenstand, des Gegenstands
// Themen, dem Thema, das Thema, des Themas

// passen auf den Gegenstand auf
