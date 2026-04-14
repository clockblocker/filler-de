import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";

export const GermanInterjectionInflectionalFeaturesSchema = z
	.object({})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"INTJ"
	>["surface"]["inflectionalFeatures"]
>;

export const GermanInterjectionInherentFeaturesSchema = z
	.object({})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "INTJ">["inherentFeatures"]
>;
