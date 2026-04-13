import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import {
	EnglishAuxiliaryMood,
	EnglishAuxiliaryNumber,
	EnglishAuxiliaryPerson,
	EnglishAuxiliaryTense,
	EnglishAuxiliaryVerbForm,
} from "./english-auxiliary-enums";

export const EnglishAuxiliaryInflectionalFeaturesSchema = z
	.object({
		mood: EnglishAuxiliaryMood.optional(),
		number: EnglishAuxiliaryNumber.optional(),
		person: EnglishAuxiliaryPerson.optional(),
		tense: EnglishAuxiliaryTense.optional(),
		verbForm: EnglishAuxiliaryVerbForm.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"AUX"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishAuxiliaryInherentFeaturesSchema = z
	.object({})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "AUX">["inherentFeatures"]
>;
