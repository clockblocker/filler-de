import z from "zod/v3";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	GermanCase,
	GermanGender,
	GermanNumber,
} from "../../../shared/german-common-enums";

export const GermanNounInflectionalFeaturesSchema = z
	.object({
		case: GermanCase.optional(),
		number: GermanNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "NOUN">;

export const GermanNounInherentFeaturesSchema = z
	.object({
		gender: GermanGender.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "NOUN">;
