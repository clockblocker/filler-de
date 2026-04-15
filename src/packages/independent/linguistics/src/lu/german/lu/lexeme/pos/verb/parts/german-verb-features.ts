import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	GermanVerbGender,
	GermanVerbMood,
	GermanVerbNumber,
	GermanVerbPerson,
	GermanVerbTense,
	GermanVerbVerbForm,
} from "./german-verb-enums";

export const GermanVerbInflectionalFeaturesSchema = z
	.object({
		gender: GermanVerbGender.optional(),
		mood: GermanVerbMood.optional(),
		number: GermanVerbNumber.optional(),
		person: GermanVerbPerson.optional(),
		tense: GermanVerbTense.optional(),
		verbForm: GermanVerbVerbForm.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme">;

export const GermanVerbInherentFeaturesSchema = z
	.object({
		governedPreposition: UniversalFeature.GovernedPreposition.optional(),
		isPhrasal: UniversalFeature.IsPhrasal.optional(),
		reflex: UniversalFeature.IsReflex.optional(),
		separable: UniversalFeature.IsSeparable.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme">;
