import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishCase,
	EnglishGender,
	EnglishNumber,
} from "../../../shared/english-common-enums";
import {
	EnglishNumeralNumType,
} from "./english-numeral-enums";

export const EnglishNumeralInflectionalFeaturesSchema = z
	.object({
		case: EnglishCase.optional(),
		gender: EnglishGender.optional(),
		number: EnglishNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "NUM">;

export const EnglishNumeralInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.Abbr.optional(),
		foreign: UniversalFeature.Foreign.optional(),
		numType: EnglishNumeralNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "NUM">;
