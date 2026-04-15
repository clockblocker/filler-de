import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
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
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
		numType: GermanNumeralNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "NUM">;
