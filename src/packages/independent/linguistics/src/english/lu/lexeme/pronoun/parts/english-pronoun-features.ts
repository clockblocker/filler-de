import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsPoss } from "../../../../../universal/enums/feature/ud/poss";
import { IsReflex } from "../../../../../universal/enums/feature/ud/reflex";
import {
	EnglishPronounCase,
	EnglishPronounGender,
	EnglishPronounNumber,
	EnglishPronounPerson,
	EnglishPronounPronType,
} from "./english-pronoun-enums";

export const EnglishPronounInflectionalFeaturesSchema = z
	.object({
		case: EnglishPronounCase.optional(),
		gender: EnglishPronounGender.optional(),
		number: EnglishPronounNumber.optional(),
		reflex: IsReflex.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"PRON"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishPronounInherentFeaturesSchema = z
	.object({
		person: EnglishPronounPerson.optional(),
		poss: IsPoss.optional(),
		pronType: EnglishPronounPronType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "PRON">["inherentFeatures"]
>;
