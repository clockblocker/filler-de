import z from "zod/v3";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import { GermanVerbalInflectionalFeaturesSchema } from "../../../shared/german-verbal-inflection-features";

export const GermanAuxiliaryInflectionalFeaturesSchema =
	GermanVerbalInflectionalFeaturesSchema satisfies InflectionalFeaturesSchemaFor<
		"Lexeme",
		"AUX"
	>;

export const GermanAuxiliaryInherentFeaturesSchema = z
	.object({})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "AUX">;
