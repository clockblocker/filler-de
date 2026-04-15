import z from "zod/v3";
import type {
	InherentFeaturesSchemaFor,
	InflectionalFeaturesSchemaFor,
} from "../../../../../universal/helpers/schema-targets";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	GermanNumeralCase,
	GermanNumeralGender,
	GermanNumeralNumber,
	GermanNumeralNumType,
} from "./german-numeral-enums";

export const GermanNumeralInflectionalFeaturesSchema = z
	.object({
		case: GermanNumeralCase.optional(),
		gender: GermanNumeralGender.optional(),
		number: GermanNumeralNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "NUM">;

export const GermanNumeralInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		numType: GermanNumeralNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "NUM">;
