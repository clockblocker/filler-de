import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishNumeralCase,
	EnglishNumeralGender,
	EnglishNumeralNumber,
	EnglishNumeralNumType,
} from "./english-numeral-enums";

export const EnglishNumeralInflectionalFeaturesSchema = z
	.object({
		case: EnglishNumeralCase.optional(),
		gender: EnglishNumeralGender.optional(),
		number: EnglishNumeralNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "NUM">;

export const EnglishNumeralInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
		numType: EnglishNumeralNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "NUM">;
