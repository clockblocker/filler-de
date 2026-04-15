import z from "zod/v3";
import type {
	InherentFeaturesSchemaFor,
	InflectionalFeaturesSchemaFor,
} from "../../../../../universal/helpers/schema-targets";
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
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "AUX">;

export const EnglishAuxiliaryInherentFeaturesSchema = z
	.object({})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "AUX">;
