import z from "zod/v3";
import type {
	InherentFeaturesSchemaFor,
	InflectionalFeaturesSchemaFor,
} from "../../../../../universal/helpers/schema-targets";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	GermanAdjectiveCase,
	GermanAdjectiveDegree,
	GermanAdjectiveGender,
	GermanAdjectiveNumber,
	GermanAdjectiveNumType,
} from "./german-adjective-enums";

export const GermanAdjectiveInflectionalFeaturesSchema = z
	.object({
		case: GermanAdjectiveCase.optional(),
		degree: GermanAdjectiveDegree.optional(),
		gender: GermanAdjectiveGender.optional(),
		number: GermanAdjectiveNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "ADJ">;

export const GermanAdjectiveInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		numType: GermanAdjectiveNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "ADJ">;
