import z from "zod/v3";
import type {
	InherentFeaturesSchemaFor,
	InflectionalFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
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
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "AUX">;

export const GermanAuxiliaryInherentFeaturesSchema = z
	.object({})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "AUX">;
