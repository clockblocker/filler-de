import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	GermanOtherCase,
	GermanOtherGender,
	GermanOtherMood,
	GermanOtherNumber,
	GermanOtherNumType,
	GermanOtherVerbForm,
} from "./german-other-enums";

export const GermanOtherInflectionalFeaturesSchema = z
	.object({
		case: GermanOtherCase.optional(),
		gender: GermanOtherGender.optional(),
		mood: GermanOtherMood.optional(),
		number: GermanOtherNumber.optional(),
		verbForm: GermanOtherVerbForm.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "X">;

export const GermanOtherInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
		numType: GermanOtherNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "X">;
