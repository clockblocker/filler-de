import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	GermanAdjectiveCase,
	GermanAdjectiveDegree,
	GermanAdjectiveGender,
	GermanAdjectiveNumber,
	GermanAdjectiveNumType,
} from "./german-adjective-enums";

export const GermanAdjectiveInflectionalFeaturesSchema = z
	.object({
		case: GermanAdjectiveCase.optional(),
		degree: GermanAdjectiveDegree.optional(),
		gender: GermanAdjectiveGender.optional(),
		number: GermanAdjectiveNumber.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"ADJ"
	>["surface"]["inflectionalFeatures"]
>;

export const GermanAdjectiveInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		numType: GermanAdjectiveNumType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "ADJ">["inherentFeatures"]
>;
