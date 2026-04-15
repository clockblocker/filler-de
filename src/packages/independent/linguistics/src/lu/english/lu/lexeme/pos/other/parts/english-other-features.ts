import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishCase,
	EnglishGender,
	EnglishMood,
	EnglishNumber,
	EnglishVerbForm,
} from "../../../shared/english-common-enums";
import {
	EnglishOtherNumType,
} from "./english-other-enums";

export const EnglishOtherInflectionalFeaturesSchema = z
	.object({
		case: EnglishCase.optional(),
		gender: EnglishGender.optional(),
		mood: EnglishMood.optional(),
		number: EnglishNumber.optional(),
		verbForm: EnglishVerbForm.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "X">;

export const EnglishOtherInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
		numType: EnglishOtherNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "X">;
