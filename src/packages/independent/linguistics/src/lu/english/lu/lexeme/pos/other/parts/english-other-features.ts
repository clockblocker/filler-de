import z from "zod/v3";
import type {
	InherentFeaturesSchemaFor,
	InflectionalFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import { IsAbbr } from "../../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../../universal/enums/feature/ud/foreign";
import {
	EnglishOtherCase,
	EnglishOtherGender,
	EnglishOtherMood,
	EnglishOtherNumber,
	EnglishOtherNumType,
	EnglishOtherVerbForm,
} from "./english-other-enums";

export const EnglishOtherInflectionalFeaturesSchema = z
	.object({
		case: EnglishOtherCase.optional(),
		gender: EnglishOtherGender.optional(),
		mood: EnglishOtherMood.optional(),
		number: EnglishOtherNumber.optional(),
		verbForm: EnglishOtherVerbForm.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "X">;

export const EnglishOtherInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		numType: EnglishOtherNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "X">;
