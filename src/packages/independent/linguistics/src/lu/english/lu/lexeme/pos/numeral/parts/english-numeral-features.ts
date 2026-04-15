import z from "zod/v3";
import type {
	InherentFeaturesSchemaFor,
	InflectionalFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import { IsAbbr } from "../../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../../universal/enums/feature/ud/foreign";
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
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		numType: EnglishNumeralNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "NUM">;
