import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import { EnglishCase } from "../../shared/english-common-enums";

export const EnglishAdpositionInflectionalFeaturesSchema = z
	.object({
		case: EnglishCase.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"ADP"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishAdpositionInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "ADP">["inherentFeatures"]
>;
