import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import { GermanCase } from "../../../shared/german-common-enums";

export const GermanAdpositionInflectionalFeaturesSchema = z
	.object({
		case: GermanCase.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "ADP">;

export const GermanAdpositionInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "ADP">;
