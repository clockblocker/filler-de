import z from "zod/v3";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishMood,
	EnglishNumber,
	EnglishPerson,
	EnglishTense,
	EnglishVerbForm,
} from "../../../shared/english-common-enums";

export const EnglishAuxiliaryInflectionalFeaturesSchema = z
	.object({
		mood: EnglishMood.optional(),
		number: EnglishNumber.optional(),
		person: EnglishPerson.optional(),
		tense: EnglishTense.optional(),
		verbForm: EnglishVerbForm.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "AUX">;

export const EnglishAuxiliaryInherentFeaturesSchema = z
	.object({})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "AUX">;
