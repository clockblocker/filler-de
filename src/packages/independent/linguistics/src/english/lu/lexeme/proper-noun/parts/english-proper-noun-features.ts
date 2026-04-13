import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	EnglishProperNounCase,
	EnglishProperNounGender,
	EnglishProperNounNumber,
} from "./english-proper-noun-enums";

export const EnglishProperNounInflectionalFeaturesSchema = z
	.object({
		case: EnglishProperNounCase.optional(),
		number: EnglishProperNounNumber.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"PROPN"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishProperNounInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		gender: EnglishProperNounGender.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "PROPN">["inherentFeatures"]
>;
