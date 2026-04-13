import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import {
	EnglishNounCase,
	EnglishNounGender,
	EnglishNounNumber,
} from "./english-noun-enums";

export const EnglishNounInflectionalFeaturesSchema = z
	.object({
		case: EnglishNounCase.optional(),
		number: EnglishNounNumber.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"NOUN"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishNounInherentFeaturesSchema = z
	.object({
		gender: EnglishNounGender.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "NOUN">["inherentFeatures"]
>;
