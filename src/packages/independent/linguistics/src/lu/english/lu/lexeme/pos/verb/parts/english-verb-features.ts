import z from "zod/v3";
import { GovernedPreposition } from "../../../../../../universal/enums/feature/custom/governed-preposition";
import { IsPhrasal } from "../../../../../../universal/enums/feature/custom/is-phrasal";
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
		governedPreposition: GovernedPreposition.optional(),
		isPhrasal: IsPhrasal.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "VERB">;
