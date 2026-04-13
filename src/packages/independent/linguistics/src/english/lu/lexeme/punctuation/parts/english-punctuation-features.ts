import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";

export const EnglishPunctuationInflectionalFeaturesSchema = z
	.object({})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"PUNCT"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishPunctuationInherentFeaturesSchema = z
	.object({})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "PUNCT">["inherentFeatures"]
>;
