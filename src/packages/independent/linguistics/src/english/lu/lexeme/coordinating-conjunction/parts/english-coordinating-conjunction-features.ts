import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";

export const EnglishCoordinatingConjunctionInflectionalFeaturesSchema = z
	.object({})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"CCONJ"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishCoordinatingConjunctionInherentFeaturesSchema = z
	.object({})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "CCONJ">["inherentFeatures"]
>;
