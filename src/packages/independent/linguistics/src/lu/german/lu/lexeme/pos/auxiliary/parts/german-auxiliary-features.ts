import z from "zod/v3";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	GermanGender,
	GermanMood,
	GermanNumber,
	GermanPerson,
	GermanTense,
	GermanVerbForm,
} from "../../../shared/german-common-enums";

export const GermanAuxiliaryInflectionalFeaturesSchema = z
	.object({
		gender: GermanGender.optional(),
		mood: GermanMood.optional(),
		number: GermanNumber.optional(),
		person: GermanPerson.optional(),
		tense: GermanTense.optional(),
		verbForm: GermanVerbForm.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "AUX">;

export const GermanAuxiliaryInherentFeaturesSchema = z
	.object({})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "AUX">;
