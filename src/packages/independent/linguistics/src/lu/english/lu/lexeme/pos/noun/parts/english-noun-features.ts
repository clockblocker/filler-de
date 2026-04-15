import z from "zod/v3";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import { EnglishNounCase, EnglishNounNumber } from "./english-noun-enums";

export const EnglishNounInflectionalFeaturesSchema = z
	.object({
		case: EnglishNounCase.optional(),
		number: EnglishNounNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "NOUN">;

export const EnglishNounInherentFeaturesSchema = z
	.object({})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "NOUN">;
