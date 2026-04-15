import z from "zod/v3";
import type {
	InherentFeaturesSchemaFor,
	InflectionalFeaturesSchemaFor,
} from "../../../../../universal/helpers/schema-targets";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import { GermanCase } from "../../shared/german-common-enums";

export const GermanAdpositionInflectionalFeaturesSchema = z
	.object({
		case: GermanCase.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "ADP">;

export const GermanAdpositionInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "ADP">;
