import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	EnglishAdjectiveDegree,
	EnglishAdjectiveNumType,
} from "./english-adjective-enums";

export const EnglishAdjectiveInflectionalFeaturesSchema = z
	.object({
		degree: EnglishAdjectiveDegree.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"ADJ"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishAdjectiveInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		numType: EnglishAdjectiveNumType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "ADJ">["inherentFeatures"]
>;
