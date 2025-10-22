import { z } from "zod";
import {
	Case,
	InflectionalDimension,
	Number,
	PartOfSpeech,
	Person,
} from "../general-linguistic-enums/linguistics-enums";

type AbstractInflection = Record<InflectionalDimension, string>;

const DePerson = z.enum([Person.First, Person.Second, Person.Third]);
const DeNumber = z.enum([Number.Singular, Number.Plural]);
const DeCase = z.enum([
	Case.Nominative,
	Case.Dative,
	Case.Accusative,
	Case.Genitive,
]);

// type GermanInflection = {
// 	[InflectionalDimension.Person]: Person.First | Person.Second | Person.Third;
// 	[InflectionalDimension.Case]: Case.;
// };

export const posTagFormFromPos: Record<PartOfSpeech, InflectionalDimension[]> =
	{
		[PartOfSpeech.Noun]: [
			InflectionalDimension.Case,
			InflectionalDimension.Gender,
			InflectionalDimension.Number,
		],
		[PartOfSpeech.Pronoun]: [
			InflectionalDimension.Case,
			InflectionalDimension.Gender,
			InflectionalDimension.Number,
		],
		[PartOfSpeech.Article]: [
			InflectionalDimension.Case,
			InflectionalDimension.Gender,
			InflectionalDimension.Number,
		],
		[PartOfSpeech.Adjective]: [
			InflectionalDimension.Case,
			InflectionalDimension.Gender,
			InflectionalDimension.Number,
			InflectionalDimension.Comparison,
		],
		[PartOfSpeech.Verb]: [
			InflectionalDimension.Person,
			InflectionalDimension.Number,
			InflectionalDimension.Tense,
			InflectionalDimension.Mood,
			InflectionalDimension.Voice,
		],
		[PartOfSpeech.Preposition]: [],
		[PartOfSpeech.Adverb]: [],
		[PartOfSpeech.Particle]: [],
		[PartOfSpeech.Conjunction]: [],
		[PartOfSpeech.InteractionalUnit]: [],
	} as const;

// isTechnicalTerm?: boolean;
// domain?: 'medicine' | 'physics' | 'law' | ...;

// streuen
// über jN

const a = {
	mainVerb: "vorbereiten",
	auxiliaries: ["hätte"],
	modal: "müssen",
	reflexive: "sich",
	governedPhrases: ["auf den großen Moment"],
	particles: ["vor"],
};
