import z from "zod/v3";
import { GovernedPreposition } from "../../../../../../universal/enums/feature/custom/governed-preposition";
import { IsPhrasal } from "../../../../../../universal/enums/feature/custom/is-phrasal";
import { IsSeparable } from "../../../../../../universal/enums/feature/custom/separable";
import { IsReflex } from "../../../../../../universal/enums/feature/ud/reflex";
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
		governedPreposition: GovernedPreposition.optional(),
		isPhrasal: IsPhrasal.optional(),
		reflex: IsReflex.optional(),
		separable: IsSeparable.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme">;
