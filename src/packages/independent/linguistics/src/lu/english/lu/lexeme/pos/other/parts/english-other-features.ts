import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
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
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
		numType: EnglishOtherNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "X">;
