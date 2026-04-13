import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	EnglishOtherCase,
	EnglishOtherGender,
	EnglishOtherMood,
	EnglishOtherNumber,
	EnglishOtherNumType,
	EnglishOtherVerbForm,
} from "./english-other-enums";

export const EnglishOtherInflectionalFeaturesSchema = z
	.object({
		case: EnglishOtherCase.optional(),
		gender: EnglishOtherGender.optional(),
		mood: EnglishOtherMood.optional(),
		number: EnglishOtherNumber.optional(),
		verbForm: EnglishOtherVerbForm.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"X"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishOtherInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		numType: EnglishOtherNumType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "X">["inherentFeatures"]
>;
