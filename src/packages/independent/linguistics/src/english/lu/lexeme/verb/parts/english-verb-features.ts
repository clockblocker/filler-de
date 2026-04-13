import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import {
	EnglishVerbMood,
	EnglishVerbNumber,
	EnglishVerbPerson,
	EnglishVerbTense,
	EnglishVerbVerbForm,
} from "./english-verb-enums";

export const EnglishVerbInflectionalFeaturesSchema = z
	.object({
		mood: EnglishVerbMood.optional(),
		number: EnglishVerbNumber.optional(),
		person: EnglishVerbPerson.optional(),
		tense: EnglishVerbTense.optional(),
		verbForm: EnglishVerbVerbForm.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"VERB"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishVerbInherentFeaturesSchema = z
	.object({})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "VERB">["inherentFeatures"]
>;
