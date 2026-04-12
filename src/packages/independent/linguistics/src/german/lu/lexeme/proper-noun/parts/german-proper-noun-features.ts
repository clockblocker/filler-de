import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	GermanProperNounCase,
	GermanProperNounGender,
	GermanProperNounNumber,
} from "./german-proper-noun-enums";

export const GermanProperNounInflectionalFeaturesSchema = z
	.object({
		case: GermanProperNounCase.optional(),
		number: GermanProperNounNumber.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"PROPN"
	>["surface"]["inflectionalFeatures"]
>;

export const GermanProperNounInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		gender: GermanProperNounGender.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "PROPN">["inherentFeatures"]
>;
