import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import {
	GermanAuxiliaryGender,
	GermanAuxiliaryMood,
	GermanAuxiliaryNumber,
	GermanAuxiliaryPerson,
	GermanAuxiliaryTense,
	GermanAuxiliaryVerbForm,
} from "./german-auxiliary-enums";

export const GermanAuxiliaryInflectionalFeaturesSchema = z
	.object({
		gender: GermanAuxiliaryGender.optional(),
		mood: GermanAuxiliaryMood.optional(),
		number: GermanAuxiliaryNumber.optional(),
		person: GermanAuxiliaryPerson.optional(),
		tense: GermanAuxiliaryTense.optional(),
		verbForm: GermanAuxiliaryVerbForm.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"AUX"
	>["surface"]["inflectionalFeatures"]
>;

export const GermanAuxiliaryInherentFeaturesSchema = z
	.object({})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "AUX">["inherentFeatures"]
>;
