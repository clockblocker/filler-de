import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	GermanNumeralCase,
	GermanNumeralGender,
	GermanNumeralNumber,
	GermanNumeralNumType,
} from "./german-numeral-enums";

export const GermanNumeralInflectionalFeaturesSchema = z
	.object({
		case: GermanNumeralCase.optional(),
		gender: GermanNumeralGender.optional(),
		number: GermanNumeralNumber.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"NUM"
	>["surface"]["inflectionalFeatures"]
>;

export const GermanNumeralInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		numType: GermanNumeralNumType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "NUM">["inherentFeatures"]
>;
