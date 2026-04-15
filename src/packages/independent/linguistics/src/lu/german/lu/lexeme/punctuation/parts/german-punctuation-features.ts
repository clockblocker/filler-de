import z from "zod/v3";
import type {
	InherentFeaturesSchemaFor,
	InflectionalFeaturesSchemaFor,
} from "../../../../../universal/helpers/schema-targets";

export const GermanPunctuationInflectionalFeaturesSchema = z
	.object({})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "PUNCT">;

export const GermanPunctuationInherentFeaturesSchema = z
	.object({})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PUNCT">;
