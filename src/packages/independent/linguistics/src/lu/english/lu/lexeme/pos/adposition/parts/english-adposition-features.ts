import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";

export const EnglishAdpositionInflectionalFeaturesSchema = z
	.object({})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "ADP">;

export const EnglishAdpositionInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "ADP">;
