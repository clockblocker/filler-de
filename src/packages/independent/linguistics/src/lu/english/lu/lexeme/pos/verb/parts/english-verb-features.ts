import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
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

export const EnglishVerbInflectionalFeaturesSchema = z
	.object({
		mood: EnglishMood.optional(),
		number: EnglishNumber.optional(),
		person: EnglishPerson.optional(),
		tense: EnglishTense.optional(),
		verbForm: EnglishVerbForm.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "VERB">;

export const EnglishVerbInherentFeaturesSchema = z
	.object({
		governedPreposition: UniversalFeature.GovernedPreposition.optional(),
		phrasal: UniversalFeature.Phrasal.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "VERB">;
