import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsPoss } from "../../../../../universal/enums/feature/ud/poss";
import {
	EnglishDeterminerCase,
	EnglishDeterminerDefinite,
	EnglishDeterminerDegree,
	EnglishDeterminerGender,
	EnglishDeterminerNumber,
	EnglishDeterminerNumType,
	EnglishDeterminerPerson,
	EnglishDeterminerPolite,
	EnglishDeterminerPronType,
} from "./english-determiner-enums";

export const EnglishDeterminerInflectionalFeaturesSchema = z
	.object({
		case: EnglishDeterminerCase.optional(),
		degree: EnglishDeterminerDegree.optional(),
		gender: EnglishDeterminerGender.optional(),
		number: EnglishDeterminerNumber.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"DET"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishDeterminerInherentFeaturesSchema = z
	.object({
		definite: EnglishDeterminerDefinite.optional(),
		numType: EnglishDeterminerNumType.optional(),
		person: EnglishDeterminerPerson.optional(),
		polite: EnglishDeterminerPolite.optional(),
		poss: IsPoss.optional(),
		pronType: EnglishDeterminerPronType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "DET">["inherentFeatures"]
>;
