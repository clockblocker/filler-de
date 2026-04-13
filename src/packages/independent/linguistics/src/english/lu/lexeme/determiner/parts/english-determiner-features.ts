import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsPoss } from "../../../../../universal/enums/feature/ud/poss";
import {
	EnglishDeterminerDefinite,
	EnglishDeterminerNumber,
	EnglishDeterminerNumType,
	EnglishDeterminerPerson,
	EnglishDeterminerPronType,
} from "./english-determiner-enums";

export const EnglishDeterminerInflectionalFeaturesSchema = z
	.object({
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
		poss: IsPoss.optional(),
		pronType: EnglishDeterminerPronType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "DET">["inherentFeatures"]
>;
