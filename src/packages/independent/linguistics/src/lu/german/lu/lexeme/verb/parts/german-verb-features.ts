import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { GovernedPreposition } from "../../../../../universal/enums/feature/custom/governed-preposition";
import { IsPhrasal } from "../../../../../universal/enums/feature/custom/is-phrasal";
import { IsSeparable } from "../../../../../universal/enums/feature/custom/separable";
import { IsReflex } from "../../../../../universal/enums/feature/ud/reflex";
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
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme"
	>["surface"]["inflectionalFeatures"]
>;

export const GermanVerbInherentFeaturesSchema = z
	.object({
		governedPreposition: GovernedPreposition.optional(),
		isPhrasal: IsPhrasal.optional(),
		reflex: IsReflex.optional(),
		separable: IsSeparable.optional(),
	})
	.strict() satisfies z.ZodType<AbstractLemma<"Lexeme">["inherentFeatures"]>;
