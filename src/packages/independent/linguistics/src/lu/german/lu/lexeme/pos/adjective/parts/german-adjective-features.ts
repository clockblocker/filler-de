import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	GermanCase,
	GermanDegree,
	GermanGender,
	GermanNumber,
} from "../../../shared/german-common-enums";
import {
	GermanAdjectiveNumType,
} from "./german-adjective-enums";

export const GermanAdjectiveInflectionalFeaturesSchema = z
	.object({
		case: GermanCase.optional(),
		degree: GermanDegree.optional(),
		gender: GermanGender.optional(),
		number: GermanNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "ADJ">;

export const GermanAdjectiveInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
		numType: GermanAdjectiveNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "ADJ">;
