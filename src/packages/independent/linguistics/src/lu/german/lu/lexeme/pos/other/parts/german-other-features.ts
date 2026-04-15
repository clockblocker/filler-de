import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	GermanCase,
	GermanGender,
	GermanMood,
	GermanNumber,
	GermanVerbForm,
} from "../../../shared/german-common-enums";
import {
	GermanOtherNumType,
} from "./german-other-enums";

export const GermanOtherInflectionalFeaturesSchema = z
	.object({
		case: GermanCase.optional(),
		gender: GermanGender.optional(),
		mood: GermanMood.optional(),
		number: GermanNumber.optional(),
		verbForm: GermanVerbForm.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "X">;

export const GermanOtherInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
		numType: GermanOtherNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "X">;
