import z from "zod/v3";
import type {
	InherentFeaturesSchemaFor,
	InflectionalFeaturesSchemaFor,
} from "../../../../../universal/helpers/schema-targets";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
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
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		numType: GermanOtherNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "X">;
