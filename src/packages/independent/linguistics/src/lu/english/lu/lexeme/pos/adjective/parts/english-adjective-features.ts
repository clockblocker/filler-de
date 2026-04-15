import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishAdjectiveDegree,
	EnglishAdjectiveNumType,
} from "./english-adjective-enums";

export const EnglishAdjectiveInflectionalFeaturesSchema = z
	.object({
		degree: EnglishAdjectiveDegree.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "ADJ">;

export const EnglishAdjectiveInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
		numType: EnglishAdjectiveNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "ADJ">;
