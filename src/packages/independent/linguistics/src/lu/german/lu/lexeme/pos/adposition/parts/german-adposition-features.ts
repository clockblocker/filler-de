import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";

export const GermanAdpositionInflectionalFeaturesSchema = z
	.object({})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "ADP">;

export const GermanAdpositionInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.Abbr.optional(),
		foreign: UniversalFeature.Foreign.optional(),
		governedCase: UniversalFeature.GovernedCase.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "ADP">;
