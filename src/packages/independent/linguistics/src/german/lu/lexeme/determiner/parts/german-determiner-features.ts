import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsPoss } from "../../../../../universal/enums/feature/ud/poss";
import {
	GermanDeterminerCase,
	GermanDeterminerDefinite,
	GermanDeterminerDegree,
	GermanDeterminerGender,
	GermanDeterminerNumber,
	GermanDeterminerNumType,
	GermanDeterminerPerson,
	GermanDeterminerPolite,
	GermanDeterminerPronType,
} from "./german-determiner-enums";

export const GermanDeterminerInflectionalFeaturesSchema = z
	.object({
		case: GermanDeterminerCase.optional(),
		degree: GermanDeterminerDegree.optional(),
		gender: GermanDeterminerGender.optional(),
		number: GermanDeterminerNumber.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"DET"
	>["surface"]["inflectionalFeatures"]
>;

export const GermanDeterminerInherentFeaturesSchema = z
	.object({
		definite: GermanDeterminerDefinite.optional(),
		numType: GermanDeterminerNumType.optional(),
		person: GermanDeterminerPerson.optional(),
		polite: GermanDeterminerPolite.optional(),
		poss: IsPoss.optional(),
		pronType: GermanDeterminerPronType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "DET">["inherentFeatures"]
>;
