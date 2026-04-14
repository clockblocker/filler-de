import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	EnglishNumeralCase,
	EnglishNumeralGender,
	EnglishNumeralNumber,
	EnglishNumeralNumType,
} from "./english-numeral-enums";

export const EnglishNumeralInflectionalFeaturesSchema = z
	.object({
		case: EnglishNumeralCase.optional(),
		gender: EnglishNumeralGender.optional(),
		number: EnglishNumeralNumber.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"NUM"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishNumeralInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		numType: EnglishNumeralNumType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "NUM">["inherentFeatures"]
>;
