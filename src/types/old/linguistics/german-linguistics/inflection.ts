import { z } from "zod";
import {
	Case,
	InflectionalDimension,
	NumberKind,
	Person,
	POS,
} from "../../../../linguistics/old-enums";

type AbstractInflection = Record<InflectionalDimension, string>;

const _DePerson = z.enum([Person.First, Person.Second, Person.Third]);
const _DeNumber = z.enum([NumberKind.Singular, NumberKind.Plural]);
const _DeCase = z.enum([
	Case.Nominative,
	Case.Dative,
	Case.Accusative,
	Case.Genitive,
]);

// type GermanInflection = {
// 	[InflectionalDimension.Person]: Person.First | Person.Second | Person.Third;
// 	[InflectionalDimension.Case]: Case.;
// };

export const posTagFormFromPos: Record<POS, InflectionalDimension[]> = {
	[POS.Noun]: [
		InflectionalDimension.Case,
		InflectionalDimension.Gender,
		InflectionalDimension.Number,
	],
	[POS.Pronoun]: [
		InflectionalDimension.Case,
		InflectionalDimension.Gender,
		InflectionalDimension.Number,
	],
	[POS.Article]: [
		InflectionalDimension.Case,
		InflectionalDimension.Gender,
		InflectionalDimension.Number,
	],
	[POS.Adjective]: [
		InflectionalDimension.Case,
		InflectionalDimension.Gender,
		InflectionalDimension.Number,
		InflectionalDimension.Comparison,
	],
	[POS.Verb]: [
		InflectionalDimension.Person,
		InflectionalDimension.Number,
		InflectionalDimension.Tense,
		InflectionalDimension.Mood,
		InflectionalDimension.Voice,
	],
	[POS.Preposition]: [],
	[POS.Adverb]: [],
	[POS.Particle]: [],
	[POS.Conjunction]: [],
	[POS.InteractionalUnit]: [],
} as const;

// isTechnicalTerm?: boolean;
// domain?: 'medicine' | 'physics' | 'law' | ...;

// streuen
// über jN

const _a = {
	auxiliaries: ["hätte"],
	governedPhrases: ["auf den großen Moment"],
	mainVerb: "vorbereiten",
	modal: "müssen",
	particles: ["vor"],
	reflexive: "sich",
};
