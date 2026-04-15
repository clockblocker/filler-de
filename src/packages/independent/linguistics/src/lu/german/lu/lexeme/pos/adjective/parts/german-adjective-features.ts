import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
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
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
		numType: GermanAdjectiveNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "ADJ">;
