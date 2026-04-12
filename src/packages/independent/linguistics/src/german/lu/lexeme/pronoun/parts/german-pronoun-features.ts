import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsPoss } from "../../../../../universal/enums/feature/ud/poss";
import { IsReflex } from "../../../../../universal/enums/feature/ud/reflex";
import {
	GermanPronounCase,
	GermanPronounGender,
	GermanPronounNumber,
	GermanPronounPerson,
	GermanPronounPolite,
	GermanPronounPronType,
} from "./german-pronoun-enums";

export const GermanPronounInflectionalFeaturesSchema = z
	.object({
		case: GermanPronounCase.optional(),
		gender: GermanPronounGender.optional(),
		number: GermanPronounNumber.optional(),
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

export const GermanPronounInherentFeaturesSchema = z
	.object({
		person: GermanPronounPerson.optional(),
		polite: GermanPronounPolite.optional(),
		poss: IsPoss.optional(),
		pronType: GermanPronounPronType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "PRON">["inherentFeatures"]
>;
