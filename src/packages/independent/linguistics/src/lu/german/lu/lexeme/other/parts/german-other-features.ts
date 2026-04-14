import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	GermanOtherCase,
	GermanOtherGender,
	GermanOtherMood,
	GermanOtherNumber,
	GermanOtherNumType,
	GermanOtherVerbForm,
} from "./german-other-enums";

export const GermanOtherInflectionalFeaturesSchema = z
	.object({
		case: GermanOtherCase.optional(),
		gender: GermanOtherGender.optional(),
		mood: GermanOtherMood.optional(),
		number: GermanOtherNumber.optional(),
		verbForm: GermanOtherVerbForm.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"X"
	>["surface"]["inflectionalFeatures"]
>;

export const GermanOtherInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		numType: GermanOtherNumType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "X">["inherentFeatures"]
>;
