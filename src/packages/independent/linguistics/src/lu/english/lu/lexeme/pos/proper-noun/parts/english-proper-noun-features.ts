import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishProperNounCase,
	EnglishProperNounNumber,
} from "./english-proper-noun-enums";

export const EnglishProperNounInflectionalFeaturesSchema = z
	.object({
		case: EnglishProperNounCase.optional(),
		number: EnglishProperNounNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "PROPN">;

export const EnglishProperNounInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PROPN">;
