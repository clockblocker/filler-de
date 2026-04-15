import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
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

export const GermanVerbInflectionalFeaturesSchema = z
	.object({
		gender: GermanGender.optional(),
		mood: GermanMood.optional(),
		number: GermanNumber.optional(),
		person: GermanPerson.optional(),
		tense: GermanTense.optional(),
		verbForm: GermanVerbForm.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme">;

export const GermanVerbInherentFeaturesSchema = z
	.object({
		governedPreposition: UniversalFeature.GovernedPreposition.optional(),
		phrasal: UniversalFeature.Phrasal.optional(),
		reflex: UniversalFeature.Reflex.optional(),
		separable: UniversalFeature.Separable.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme">;
