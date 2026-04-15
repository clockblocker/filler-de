import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
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
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "VERB">;

export const EnglishVerbInherentFeaturesSchema = z
	.object({
		governedPreposition: UniversalFeature.GovernedPreposition.optional(),
		isPhrasal: UniversalFeature.IsPhrasal.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "VERB">;
