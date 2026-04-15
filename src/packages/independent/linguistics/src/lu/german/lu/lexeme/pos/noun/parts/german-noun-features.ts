import z from "zod/v3";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	GermanNounCase,
	GermanNounGender,
	GermanNounNumber,
} from "./german-noun-enums";

export const GermanNounInflectionalFeaturesSchema = z
	.object({
		case: GermanNounCase.optional(),
		number: GermanNounNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "NOUN">;

export const GermanNounInherentFeaturesSchema = z
	.object({
		gender: GermanNounGender.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "NOUN">;
