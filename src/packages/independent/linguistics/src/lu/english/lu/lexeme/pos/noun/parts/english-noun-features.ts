import z from "zod/v3";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import { EnglishNumber } from "../../../shared/english-common-enums";
import { EnglishNounCase } from "./english-noun-enums";

export const EnglishNounInflectionalFeaturesSchema = z
	.object({
		case: EnglishNounCase.optional(),
		number: EnglishNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "NOUN">;

export const EnglishNounInherentFeaturesSchema = z
	.object({})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "NOUN">;
