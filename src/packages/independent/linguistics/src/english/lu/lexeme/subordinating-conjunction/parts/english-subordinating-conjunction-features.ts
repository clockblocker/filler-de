import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";

export const EnglishSubordinatingConjunctionInflectionalFeaturesSchema = z
	.object({})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"SCONJ"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishSubordinatingConjunctionInherentFeaturesSchema = z
	.object({})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "SCONJ">["inherentFeatures"]
>;
