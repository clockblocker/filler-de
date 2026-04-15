import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	GermanCase,
	GermanGender,
	GermanNumber,
} from "../../../shared/german-common-enums";
import {
	GermanNumeralNumType,
} from "./german-numeral-enums";

export const GermanNumeralInflectionalFeaturesSchema = z
	.object({
		case: GermanCase.optional(),
		gender: GermanGender.optional(),
		number: GermanNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "NUM">;

export const GermanNumeralInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
		numType: GermanNumeralNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "NUM">;
