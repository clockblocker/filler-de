import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import {
	GermanNounCase,
	GermanNounGender,
	GermanNounNumber,
} from "./german-noun-enums";

export const GermanNounInflectionalFeaturesSchema = z
	.object({
		case: GermanNounCase.optional(),
		number: GermanNounNumber.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"NOUN"
	>["surface"]["inflectionalFeatures"]
>;

export const GermanNounInherentFeaturesSchema = z
	.object({
		gender: GermanNounGender.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "NOUN">["inherentFeatures"]
>;
